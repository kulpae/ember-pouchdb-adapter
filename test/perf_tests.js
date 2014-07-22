var pouchdb,
    App, store,
    perf = new Perftest({repeat_test: 5});

var mockData = {
  'items|200': [{
    'id|+1': 1,
    '_id|+1': 1,
    'test': 'value',
    'name': "@NAME"
  }]
};

var docs = Mock.mock(mockData);
docs['items'] = docs['items'].map(function(item){
  item['id']  = item['id']+'';
  item['_id'] = item['_id']+'';
  return item;
});

perf.init();

Ember.RSVP.configure('onerror', function(error) {
  console.error(error);
  perf.queue.error(error.message || error);
  perf.queue.next();
});

window.ok = perf.queue.error.bind(perf.queue);

Ember.onerror = function(error){
  console.error(error);
  perf.queue.error(error.stack || error.message || error);
  perf.queue.next();
}

perf.module("PouchDB directly", {
  pre_module: function(test){
    test.stop();
    PouchDB.destroy("ember-pouchdb-direct-perftest", function(err, info){
      if(err){
        test.error(err);
        test.start();
      } else {
        test.start();
      }
    });
  },
  pre_test: function(test){
    test.stop();
    new PouchDB('ember-pouchdb-direct-perftest', function(err, db){
      if(err){
        test.error(err);
      } else {
        window.pouchdb = db;
        test.start();
      }
    });
  },
  post_test: function(test){
    test.stop();
    PouchDB.destroy("ember-pouchdb-direct-perftest", function(err, info){
      if(err){
        test.error(err);
      } else {
        test.start();
      }
    });
    pouchdb = null;
  }
});

perf.test("create", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item);
    });
  }, Ember.RSVP.resolve()).then(function(){
    test.start();
  });
});

perf.test("bulk create", function(test){
  test.stop();
  pouchdb.bulkDocs({docs: docs['items']}).then(function(){
    test.start();
  });
});

perf.test("create & update", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item).then(function(response){
        var newItem = {
          _id: item._id,
          id: item.id,
          _rev: response.rev,
          test: 'newvalue',
          name: item.name
        };
        return pouchdb.put(newItem);
      });
    });
  }, Ember.RSVP.resolve()).then(function(){
    test.start();
  });
});

perf.test("create & delete", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item).then(function(response){
        var newItem = {
          _id: item._id,
          _rev: response.rev,
        };
        return pouchdb.remove(newItem);
      });
    });
  }, Ember.RSVP.resolve()).then(function(){
    test.start();
  });
});

perf.test("create & findAll", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item);
    });
  }, Ember.RSVP.resolve()).then(function(){
    pouchdb.allDocs({include_docs: true, }).then(function(items){
      if(items.rows.length == 200){
        test.start();
      } else {
        test.error('returned an unexpected amount of data');
        test.start();
      }
    });
  });
});

perf.test("create & findSingle", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item);
    });
  }, Ember.RSVP.resolve()).then(function(){
    docs['items'].reduce(function(prev, item){
      var id = item['_id'];
      return prev.then(function(){
        return pouchdb.get(id);
      });
    }, Ember.RSVP.resolve()).then(function(){
      test.start();
    });
  });
});

perf.test("create & findSingle (alldocs+key)", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item);
    });
  }, Ember.RSVP.resolve()).then(function(){
    docs['items'].reduce(function(prev, item){
      var id = item['_id'];
      return prev.then(function(){
        return pouchdb.allDocs({key: id, include_docs: true});
      });
    }, Ember.RSVP.resolve()).then(function(){
      test.start();
    });
  });
});

perf.test("create & findQuery", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      return pouchdb.put(item);
    });
  }, Ember.RSVP.resolve()).then(function(){
    pouchdb.query(function(doc, emit){
      if(doc.test === "value"){
        emit(doc.test, doc);
      }
    }).then(function(items){
      if(items.rows.length == 200){
        test.start();
      } else {
        test.error('returned an unexpected amount of data');
        test.start();
      }
    });
  });
});

perf.module("Ember Data & Pouch Adapter", {
  pre_module: function(test){
    test.stop();
    PouchDB.destroy("ember-pouchdb-adapter-perftest", function(err, info){
      if(err){
        test.error(err);
        test.start();
      } else {
        test.start();
      }
    });
  },
  pre_test: function(test){
    Ember.run(function(){
      App = Ember.Application.create({
        Item: DS.Model.extend({
          test: DS.attr('string')
        }),
        ApplicationAdapter: DS.PouchDBAdapter.extend({
          databaseName: 'ember-pouchdb-adapter-perftest'
        }),
        ApplicationStore: DS.Store.extend({ isCustom: true })
      });
      App.setupForTesting();
      App.injectTestHelpers();
    });

    Ember.run(function(){
      store = App.__container__.lookup('store:main');
    });
  },
  post_test: function(test){
    test.stop();
    Ember.run(function(){
      PouchDB.destroy("ember-pouchdb-adapter-perftest", function(err, info){
        if(err){
          test.error(err);
          test.start();
        } else {
          Ember.run(App, App.destroy);
          Ember.run(store, store.destroy);
          test.start();
        }
      });
    });
  }
});

//helper methods from https://github.com/emberjs/data/tree/master/tests
var syncForTest = window.syncForTest = function(fn) {
  var callSuper;

  if (typeof fn !== "function") { callSuper = true; }

  return function() {
    var override = false, ret;

    if (Ember.run && !Ember.run.currentRunLoop) {
      Ember.run.begin();
      override = true;
    }

    try {
      if (callSuper) {
        ret = this._super.apply(this, arguments);
      } else {
        ret = fn.apply(this, arguments);
      }
    } finally {
      if (override) {
        Ember.run.end();
      }
    }

    return ret;
  };
};

Ember.RSVP.resolve = syncForTest(Ember.RSVP.resolve);

Ember.View.reopen({
  _insertElementLater: syncForTest()
});

DS.Store.reopen({
  save: syncForTest(),
  createRecord: syncForTest(),
  deleteRecord: syncForTest(),
  push: syncForTest(),
  pushMany: syncForTest(),
  filter: syncForTest(),
  find: syncForTest(),
  findMany: syncForTest(),
  findByIds: syncForTest(),
  didSaveRecord: syncForTest(),
  didSaveRecords: syncForTest(),
  didUpdateAttribute: syncForTest(),
  didUpdateAttributes: syncForTest(),
  didUpdateRelationship: syncForTest(),
  didUpdateRelationships: syncForTest()
});

DS.Model.reopen({
  save: syncForTest(),
  reload: syncForTest(),
  deleteRecord: syncForTest(),
  dataDidChange: Ember.observer(syncForTest(), 'data'),
  updateRecordArraysLater: syncForTest()
});

Ember.RSVP.Promise.prototype.then = syncForTest(Ember.RSVP.Promise.prototype.then);

perf.test("create", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save();
    });
  }, Ember.RSVP.resolve()).then(function(){
    test.start();
  });
});

perf.test("create & update", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save().then(function(savedRecord){
        savedRecord.set('test', 'newvalue');
        return savedRecord.save();
      });
    });
  }, Ember.RSVP.resolve()).then(function(){
    test.start();
  });
});

perf.test("create & delete", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save().then(function(savedRecord){
        return savedRecord.destroyRecord();
      });
    });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      test.start();
  });
});

perf.test("create & findAll", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save();
    });
  }, Ember.RSVP.resolve()).then(function(){
    store.find('item').then(function(items){
      if(Ember.get(items, "length") == 200){
        test.start();
      } else {
        test.error('returned an unexpected amount of data');
        test.start();
      }
    });
  });
});

perf.test("create & findSingle", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save();
    });
  }, Ember.RSVP.resolve()).then(function(){
    docs['items'].reduce(function(prev, item){
      var id = item['id'];
      return prev.then(function(){
        return store.find('item', id);
      });
    }, Ember.RSVP.resolve()).then(function(){
      test.start();
    });
  });
});

perf.test("create & findQuery", function(test){
  test.stop();
  docs['items'].reduce(function(prev, item){
    item['id'] = item['id'];
    return prev.then(function(){
      var record = store.createRecord('item', item);
      return record.save();
    });
  }, Ember.RSVP.resolve()).then(function(){
    store.find('item', {test: 'value'}).then(function(items){
      if(Ember.get(items, "length") == 200){
        test.start();
      } else {
        test.error('returned an unexpected amount of data');
        test.start();
      }
    });
  });
});
