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
  pre_test: function(test){
    test.stop();
    new PouchDB('ember-pouchdb-direct-perftest', function(err, db){
      if(err){
        test.error(err);
      } else {
        pouchdb = db;
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
      App.destroy();
      store.destroy();
      PouchDB.destroy("ember-pouchdb-adapter-perftest", function(err, info){
        if(err){
          test.error(err);
        } else {
          test.start();
        }
      });
    });
    App = null;
    store = null;
  }
});

perf.test("create", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save);
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      test.start();
    });
  });
});

perf.test("create & update", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save).then(function(savedRecord){
            savedRecord.set('test', 'newvalue');
            return Ember.run(savedRecord, savedRecord.save);
          });
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      test.start();
    });
  });
});

perf.test("create & delete", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save).then(function(savedRecord){
            return Ember.run(savedRecord, savedRecord.destroyRecord);
          });
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      test.start();
    });
  });
});

perf.test("create & findAll", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save);
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      Ember.run(function(){
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
  });
});

perf.test("create & findSingle", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save);
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      Ember.run(function(){
        docs['items'].reduce(function(prev, item){
          var id = item['id'];
          return prev.then(function(){
            return Ember.run(store, store.find, 'item', id);
          });
        }, Ember.RSVP.resolve()).then(function(){
          test.start();
        });
      });
    });
  });
});

perf.test("create & findQuery", function(test){
  test.stop();
  Ember.run(function(){
    docs['items'].reduce(function(prev, item){
      item['id'] = item['id'];
      return prev.then(function(){
        return Ember.run(function(){
          var record = store.createRecord('item', item);
          return Ember.run(record, record.save);
        });
      });
    }, Ember.run(null, Ember.RSVP.resolve)).then(function(){
      Ember.run.sync();
      Ember.run(function(){
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
  });
});
