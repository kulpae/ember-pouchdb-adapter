import DS from 'ember-data';
import Ember from 'ember';
import PouchDB from 'pouchdb';

var get = Ember.get;
var set = Ember.set;
var map = Array.prototype.map;
var forEach = Array.prototype.forEach;

function idToPouchId(id, type){
  if(Ember.isEmpty(id) || Ember.isEmpty(type)){
    return undefined;
  }
  type = type.modelName || type;
  type = Ember.String.camelize(type);
  return [type, id].join("_");
}

function pouchIdToIdType(id){
  var idx = id.indexOf("_");
  return (idx === -1) ?
    [id, null] :
    [id.substring(idx+1), Ember.String.dasherize(id.substring(0, idx))];
}

function pouchIdToId(id){
  return pouchIdToIdType(id)[0];
}

function _pagedAllDocs(adp, db, params){
  var skip = params.skip || 0;
  var limit = params.limit || -1;
  var batch_size = get(adp, "batch_size") || 200;
  var batch_all = get(adp, "batch_all");
  if(batch_all === false){
    return db.allDocs(params);
  } else {
    params.skip = skip;
    let rows = Ember.A();
    let fetchNext = () => {
      params.limit = (limit === -1)? batch_size: Math.min(batch_size, limit);
      const defer = Ember.RSVP.defer();
      Ember.run.later(function(){
        db.allDocs(params).then((result)=>{
          let count = result.rows.length;
          if(count <= 0){
            return defer.resolve(result);
          }
          params.startkey = result.rows[count - 1].key;
          params.skip = 1;
          if(limit !== -1){
            limit -= count;
          }
          rows.addObjects(result.rows);
          if (params.limit === count){
            return defer.resolve(fetchNext());
          } else {
            return defer.resolve(result);
          }
        }, function(err){
          defer.reject(err);
        });
      }, 50);
      return defer.promise;
    };
    return fetchNext().then((result) => {
      result = {rows: rows, offset: skip, total_rows: result.total_rows};
      return result;
    });
  }
}

export default DS.Adapter.extend({
  dbOptions: {},

  shouldBackgroundReloadRecord(/*store, snapshot*/){
    return true;
  },

  shouldReloadAll(store, snapshotRecordArray){
    return !snapshotRecordArray.length;
  },

  shouldBackgroundReloadAll(/*store, snapshotRecordArray*/) {
    return true;
  },


  findRecord(store, type, id/*, snapshot*/){
    var self = this,
    pouchId = idToPouchId(id, type);
    var db = self._getDb();
    return db.get(pouchId).then(function(hash){
      hash = self.fromPouchData(hash, type);
      return self.resolveDeps(store, hash, type);
    }, function(){
      return null;
    });
  },

  findMany(store, type, ids, snapshots, inflightRecords = Ember.A()){
    var self = this,
    pouchIds = map.call(ids, function(id){
      return idToPouchId(id, type);
    });
    var db = self._getDb();
    return db.allDocs({include_docs: true, keys: pouchIds}).then(function(result){
      var rows = result.rows;
      var docs = map.call(rows, function(row){
        var hash = row.doc;
        hash = self.fromPouchData(hash, type);
        return hash;
      });
      return docs.reduce(function(promise, doc){
        return promise.then(function(result){
          return self.resolveDeps(store, doc, type, inflightRecords).then(function(hash){
            result.addObject(hash);
            return result;
          });
        });
      }, Ember.RSVP.resolve(Ember.A()));
    }, function(){
      return [];
    });
  },

  findAll(store, type, sinceToken, snapshotRecordArray, options={}){
    var self = this,
        queryParams = {},
        start = Ember.String.camelize(type.modelName),
        end = start + '~~';

    queryParams['include_docs'] = true;
    queryParams['startkey'] = start;
    queryParams['endkey'] = end;
    if(options.skip){
      queryParams["skip"] = options.skip;
    }
    if(options.limit){
      queryParams["limit"] = options.limit;
    }

    var db = self._getDb();
    return _pagedAllDocs(self, db, queryParams).then(function(result){
      var rows = result.rows;
      var docs = map.call(rows, function(row){
        var hash = row.doc;
        hash = self.fromPouchData(hash, type);
        return hash;
      });
      return docs.reduce(function(promise, doc){
        return promise.then(function(result){
          return self.resolveDeps(store, doc, type).then(function(hash){
            result.addObject(hash);
            return result;
          });
        });
      }, Ember.RSVP.resolve(Ember.A()));
    }, function(err){
      console.error(err);
      return null;
    });
  },

  query(store, type, query, recordArray, options={}){
    var self = this,
        queryParams = {},
        queryFunc = null,
        metaKeys = {_limit: 'limit', _skip: 'skip'},
        metaOptionsKeys = Ember.A(['_limit', '_skip']),
        keys = [],
        useFindAll = true,
        view = null;

    for (var key in query) {
      if (query.hasOwnProperty(key)) {
        if(typeof metaKeys[key] !== 'undefined'){
          queryParams[metaKeys[key]] = query[key];
          if(!metaOptionsKeys.contains(key)){
            useFindAll = false;
          } else {
            options[metaKeys[key]] = query[key];
          }
        } else if(key === "_view"){
          view = query[key];
          useFindAll = false;
        } else {
          keys.push(key);
          useFindAll = false;
        }
      }
    }

    // if query is empty use findAll, which is faster
    if(useFindAll) {
      return self.findAll(store, type, null, recordArray, options);
    }

    var emitKeys = map.call(keys, function(key) {
      if(key === "id") {
        key = "_id";
      }
      return 'doc.' + key;
    });
    var queryKeys = map.call(keys, function(key) {
      if(key.substring(key.length - 3) === "_id" ||
         key.substring(key.length - 4) === "_ids" ||
         key === "id") {
        return idToPouchId(query[key], type);
      }
      return query[key];
    });

    // Very simple map function for a conjunction (AND) of all keys in the query
    var mapFn = 'function(doc) {' +
          'var uidx, type;' +
          'if (doc._id && (uidx = doc._id.indexOf("_")) > 0) {' +
          '  try {'+
          '    type = doc._id.substring(0, uidx);' +
          '    if(type == "'+type.modelName+'")' +
          '    emit([' + emitKeys.join(',') + '], null);' +
          '  } catch (e) {}' +
          '}' +
        '}';

    if(!Ember.isEmpty(queryKeys)){
      queryParams["key"] = [].concat(queryKeys);
    }
    queryParams["include_docs"] = true;
    queryParams["reduce"] = false;

    if(Ember.isEmpty(view)){
      queryFunc = {map: mapFn};
    } else {
      queryFunc = view;
    }

    var db = this._getDb();
    return db.query(queryFunc, queryParams).then(function(result){
      if (result.rows) {
        var docs = map.call(result.rows, function(row){
          var hash = row.doc;
          hash = self.fromPouchData(hash, type);
          return hash;
        });
        return docs.reduce(function(promise, doc){
          return promise.then(function(result){
            return self.resolveDeps(store, doc, type).then(function(hash){
              result.addObject(hash);
              return result;
            });
          });
        }, Ember.RSVP.resolve(Ember.A()));
      } else {
        return [];
      }
    });
  },

  queryRecord(store, type, query){
    return this.query(store, type, query, undefined, {limit: 1}).then(function(result){
      return result[0];
    });
  },

  generateIdForRecord(/*store, type, inputProperties*/){
    return PouchDB.utils.uuid();
  },

  createRecord(store, type, snapshot){
    var self = this,
        hash = self.serialize(snapshot, { includeId: true });

    //having _rev would make an update and produce a missing revision
    delete hash._rev;

    var db = self._getDb();
    return db.put(hash).then(function(response){
      var rhash = Ember.copy(hash, true);
      rhash.rev = response.rev;
      rhash.id = pouchIdToId(rhash._id);
      delete rhash._id;
      return self.syncRelationships(store, type, rhash, hash, "create");
    }, function(a){
      Ember.RSVP.rethrow(a);
      return null;
    });
  },

  updateRecord(store, type, snapshot){
    var self = this,
        hash = self.serialize(snapshot, { includeId: true });

    var db = self._getDb();
    return db.get(hash._id).then(function(oldHash){
      return db.put(hash).then(function(response){
        var rhash = Ember.copy(hash, true);
        rhash.rev = response.rev;
        rhash.id = pouchIdToId(hash._id);
        delete rhash._id;
        return self.syncRelationships(store, type, rhash, oldHash, "update");
      });
    }).catch(function(a){
      Ember.RSVP.rethrow(a);
      return null;
    });
  },

  deleteRecord(store, type, snapshot){
    var self = this,
        hash = self.serialize(snapshot, { includeId: true });

    var db = self._getDb();
    return db.remove(hash).then(function(response){
      var rhash = Ember.copy(hash, true);
      rhash.rev = response.rev;
      rhash.id = pouchIdToId(rhash._id);
      delete rhash._id;
      return self.syncRelationships(store, type, rhash, hash, "delete");
    }, function(a){
      Ember.RSVP.rethrow(a);
      return null;
    });
  },

  changes(options){
    var db = this._getDb();
    return db.changes(options);
  },

  /**
  * Lazily create a PouchDB instance
  *
  * @returns Promise that resolves to {PouchDB}
  * @private
  */
  _getDb: function() {
    if(this.db) {
      return this.db;
    }

    this.db = new PouchDB(this.databaseName || 'ember-application-db',
      this.dbOptions);
    //when destroyed, make a new one to continue operation on a new empty db
    this.db.on("destroyed", (/*dbName*/)=>{
      this.db = null;
      this._getDb();
    });
    return this.db;
  },

  //pouch id
  syncRelationships(store, type, newHash, oldHash, operation){
    var id = oldHash._id,
        deps = this.collectDeps(type, newHash, {separate: true, diffTo: (operation==="update")?oldHash:null});
    if(Ember.isEmpty(deps)){
      return Ember.RSVP.resolve(newHash);
    } else {
      var db = this._getDb();
      return deps.reduce(function(promise, dep){
        var relId = idToPouchId(dep.id, dep.type);
        var inverseRel = type.inverseFor(dep.rel.key, store);
        if(!inverseRel){
          //no reverse property set on other side, so ignore
          return promise;
        }
        var relKind = inverseRel.kind;
        var relKey = inverseRel.name;
        return promise.then(function(hash){
          return db.get(relId).then(function(doc){
            if(operation === "update"){
              if(relKind === "hasMany"){
                if(dep.diff === 1){
                  Ember.A(doc[relKey]);
                  doc[relKey].addObject(id);
                } else if(dep.diff === -1) {
                  Ember.A(doc[relKey]);
                  doc[relKey].removeObject(id);
                }
              } else {
                if(dep.diff === 1){
                  doc[relKey] = id;
                } else if(dep.diff === -1) {
                  doc[relKey] = undefined;
                }
              }
            } else if(operation === "delete"){
              if(relKind === "hasMany"){
                Ember.A(doc[relKey]);
                doc[relKey].removeObject(id);
              } else {
                doc[relKey] = undefined;
              }
            } else if(operation === "create") {
              if(relKind === "hasMany"){
                Ember.A(doc[relKey]);
                doc[relKey].addObject(id);
              } else {
                doc[relKey] = id;
              }
            }
            return db.put(doc).then(function(){
              return hash;
            });
          });
        });
      }, Ember.RSVP.resolve(newHash));
    }
  },


  collectDeps: function(type, hash, options={}){
    var deps = Ember.A();
    var diffTo = get(options, "diffTo");
    type.eachRelationship(function(name, rel){
      if(rel.options.async && options.ignoreAsync){
        return;
      }
      if(rel.kind === "hasMany"){
        var pids = get(hash, name) || [];
        pids = map.call(pids, function(pid){
          return pouchIdToId(pid);
        });
        if(options.separate){
          if(!Ember.isEmpty(diffTo)){
            var oids = get(diffTo, name) || [];
            var nids = pids;
            oids = map.call(oids, function(id){
              return pouchIdToId(id);
            });
            pids = [].concat(oids, nids);
            pids = Ember.A(pids).uniq().sort();
            var dift, oc, nc;
            forEach.call(pids, function(id){
              oc = oids.indexOf(id) > -1 ? 1 : 0;
              nc = nids.indexOf(id) > -1 ? 1 : 0;
              // -1: deleted, 0: unchanged, 1: added
              dift = nc - oc;
              deps.addObject({type: rel.type, id: id, rel: rel, diff: dift});
            });
          } else {
            forEach.call(pids, function(id){
              deps.addObject({type: rel.type, id: id, rel: rel});
            });
          }
        } else {
          deps.addObject({type: rel.type, ids: pids, rel: rel});
        }
      } else {
        if(rel.options.async && options.ignoreAsync){
          return;
        }
        var pid = get(hash, name);
        var oid;
        if(Ember.isPresent(pid)){
          pid = pouchIdToId(pid);
          if(options.separate){
            if(!Ember.isEmpty(diffTo)){
              oid = get(diffTo, name);
              if(oid === pid){
                deps.addObject({type: rel.type, id: pid, rel: rel, diff: 0});
              } else {
                deps.addObject({type: rel.type, id: pid, rel: rel, diff: 1});
              }
            } else {
              deps.addObject({type: rel.type, id: pid, rel: rel});
            }
          } else {
            deps.addObject({type: rel.type, ids: [pid], rel: rel});
          }
        } else {
          if(options.separate && !Ember.isEmpty(diffTo)){
            oid = get(diffTo, name);
            if(oid === pid){
              deps.addObject({type: rel.type, id: pid, rel: rel, diff: 0});
            } else {
              deps.addObject({type: rel.type, id: pid, rel: rel, diff: -1});
            }
          }
        }
      }
    });
    return deps;
  },

  /** Automagic resolving of non async relationships for serialized data.
   * Will be dropped, when sync relationships are dropped from Ember-Data
   *
   * @param store DS.Store for store.push and store.normalize
   * @param hash data which sync relationships should be loaded (non pouch format)
   * @param type DS.Model type of the data
   * @param inflightRecords list of already fetched data to avoid cyclic calls.
   * @return promise that returns the original hash
   */
  resolveDeps: function(store, hash, type, inflightRecords = Ember.A()){
    var self = this;
    var deps = this.collectDeps(type, hash, {ignoreAsync: true});
    inflightRecords.addObject(type.modelName + "_" + hash.id);
    if(Ember.isEmpty(deps)){
      return Ember.RSVP.resolve(hash);
    } else {
      return deps.reduce(function(promise, dep){
        var model = store.modelFor(dep.type);
        var ids = dep.ids;
        ids = ids.filter(function(id){
          var ifId = dep.type+"_"+id;
          var ok = !store.hasRecordForId(dep.type, id) &&
          (inflightRecords.indexOf(ifId) === -1);
          inflightRecords.addObject(ifId);
          return ok;
        });
        if(Ember.isEmpty(ids)){
          return promise;
        } else {
          return promise.then(function(hash){
            return self.findMany(store, model, ids, undefined, inflightRecords).then(function(result){
              Ember.run(function(){
                forEach.call(result, function(doc){
                  doc = store.normalize(dep.type, doc);
                  store.push(doc);
                });
              });
              return hash;
            });
          });
        }
      }, Ember.RSVP.resolve(hash));
    }
  },

  fromPouchData: function(hash, type/*, options*/){
    var payload = {};

    type.eachAttribute(function(name/*, meta*/){
      set(payload, name, get(hash, name));
    });

    payload.id = pouchIdToId(hash._id);
    payload.rev = hash["_rev"];

    type.eachRelationship(function(name, rel){
      if(rel.kind === "hasMany"){
        var pids = get(hash, name) || null;
        if(Ember.isPresent(pids)){
          set(payload, name, pids.map(function(pid){
            var idtype = pouchIdToIdType(pid);
            if(rel.options.polymorphic){
              return {id: idtype[0], type: idtype[1]};
            }
            return idtype[0];
          }));
        }
      } else {
        var pid = get(hash, name);
        if(Ember.isPresent(pid)){
          var idtype = pouchIdToIdType(pid);
          if(rel.options.polymorphic){
            set(payload, name, {id: idtype[0], type: idtype[1]});
          } else {
            set(payload, name, idtype[0]);
          }
        }
      }
    });

    return payload;
  },

  toPouchData: function(hash, snapshot/*, options*/){
    var id = idToPouchId(hash.id, snapshot.modelName),
        payload = {};

    payload._id = id;
    payload._rev = hash.rev;

    snapshot.eachAttribute(function(name/*, meta*/){
      if(name === 'rev'){
        return;
      }
      payload[name] = snapshot.attr(name);
    });

    snapshot.eachRelationship(function(key, rel){
      if(rel.kind === "hasMany"){
        var rids = snapshot.hasMany(key) || [];
        payload[key] = rids.map(function(reldata){
          return idToPouchId(reldata.id, reldata.modelName);
        });
      } else {
        var reldata = snapshot.belongsTo(key);
        if(reldata){
          payload[key] = idToPouchId(reldata.id, reldata.modelName);
        }
      }
    });


    return payload;
  },

  serialize: function(snapshot, options) {
    var hash = this._super(snapshot, options);
    hash = this.toPouchData(hash, snapshot, options);
    return hash;
  },


});
