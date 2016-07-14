import {module, test} from 'qunit';
import startApp from '../helpers/start-app';
import PouchDBAdapter from 'ember-pouchdb-adapter';
import Ember from "ember";
import PouchDB from 'pouchdb';

var run = Ember.run;
var get = Ember.get;
var set = Ember.set;
var App;

function newApp(){
  App = startApp();
  var bootPromise;
  run(function(){
    if(App.boot){
      App.advanceReadiness();
      bootPromise = App.boot();
    } else {
      bootPromise = Ember.RSVP.resolve();
    }
  });
  return bootPromise;
}

module("integration/adapter/ember-pouchdb-adapter", {
  beforeEach: function(assert){
    var done = assert.async();

    ((new PouchDB('ember-test-db')).destroy()).then(function(){
      var bootPromise = newApp();
      return bootPromise;
    }).then(function(){
      done();
    });
  },
  afterEach: function (/*assert*/) {
    run(App, 'destroy');
  }
});

// function db() {
//   return adapter().get('db');
// }

function adapter() {
  // the default adapter in the dummy app is an ember-pouch adapter
  return App.__container__.lookup('adapter:application');
}

function store() {
  return App.__container__.lookup('service:store');
}

test("it exist", function(assert){
  assert.ok(PouchDBAdapter, 'pouchdb-adapter should exist');
  run(function(){
    assert.ok(adapter(), 'instance of pouchdb-adapter should exist');
  });
});

test("it creates a record", function(assert){
  assert.expect(2);
  var done = assert.async();
  run(function(){
    var record = store().createRecord('list', { id: 'l2', name: 'two', b: true});
    assert.ok(record && record.save, "should create a record");
    record.save().then(function(a){
      assert.equal(get(a, "id"), 'l2', "should save the record and return its id");
      done();
    });
  });
});

test("it finds a record", function(assert){
  assert.expect(6);
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  run(function(){
    var record = store().createRecord('list', { id: 'l2', name: 'two', b: true});
    assert.ok(record && record.save, "should create a record");
    record.save().then(function(){
      next.resolve();
    });
  });

  next.promise.then(function(){
    run(App, 'destroy');
    newApp();
  }).then(function(){
    run(function(){
      var record = store().peekRecord('list', 'l2');
      assert.equal(record, null, "record should not be loaded ahead of the adapter call");
      store().findRecord('list', 'l2').then(function(record){
        assert.ok(record, "should return a record");
        assert.equal(get(record, "id"), "l2", "id of the record should stay the same");
        assert.equal(get(record, "name"), "two", "name of the records should stay the same");
        assert.equal(get(record, "b"), true, "property b of the record should stay the same");
        done();
      }, function(err){
        assert.ok(false, err);
        done();
      });
    });
  });
});

test('create and find different models with same id', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(2);
  run(function(){
    var record1 = store().createRecord('list', { id: 'o1', name: 'two', b: true});
    var record2 = store().createRecord('item', { id: 'o1', name: 'one', list: record1 });

    Ember.RSVP.all([record1.save(), record2.save()]).then(function() {
      next.resolve();
    });
  });

  next.promise.then(function(){
    run(App, 'destroy');
    newApp();
  }).then(function(){
    store().find('list', 'o1').then(function(list) {
      assert.equal(get(list, 'name'), 'two', 'List record should load');
      store().find('item', 'o1').then(function(item) {
        assert.equal(get(item, 'name'), 'one', 'Item record should load');
        done();
      });
    });
  });
});

test('create with generated id', function(assert) {
  var done = assert.async();
  assert.expect(1);
  run(function(){
    var record = store().createRecord('list', { name: 'one' });

    record.save().then(function(response) {
      assert.ok(get(response, 'id.length') === 36, 'UUID assigned');
      done();
    });
  });

});

test('create and find with hasMany', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store().createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      next.resolve();
    });
  });

  next.promise.then(function(){
    run(App, 'destroy');
    newApp();
  }).then(function(){
    store().find('list', 'l1').then(function(list) {
      var items = get(list, 'items');
      assert.equal(get(items, 'length'), 1, 'hasMany items should load');
      done();
    });
  });
});

test('create and find with belongsTo', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store().createRecord('item', { id: 'i1', name: 'two', list: list});

    Ember.RSVP.all([list.save(), item.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('item', 'i1').then(function(item) {
        var list = get(item, 'list');
        assert.ok(list, 'belongsTo item should load');
        assert.equal(list && get(list, 'id'), 'l1', 'belongsTo item should have its initial properties');
        assert.equal(list && get(list, 'name'), 'one', 'belongsTo item should have its initial properties');
        done();
      });
    });
  });
});

test('create and find with async belongsTo', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store().createRecord('item', { id: 'i1', name: 'two', asyncList: list});

    Ember.RSVP.all([list.save(), item.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('item', 'i1').then(function(item) {
        item.get('asyncList').then(function(list){
          assert.ok(list, 'belongsTo item should load');
          assert.equal(list && get(list, 'id'), 'l1', 'belongsTo item should have its initial properties');
          assert.equal(list && get(list, 'name'), 'one', 'belongsTo item should have its initial properties');
          done();
        });
      });
    });
  });
});

test('create and findMany', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: true });
    var list3 = store().createRecord('list', { id: 'l3', name: 'three', b: true });

    Ember.RSVP.all([list1.save(), list2.save(), list3.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findByIds('list', ['l1', 'l3']).then(function(lists){
        assert.deepEqual(lists.mapBy('id'), ['l1', 'l3'], 'records with ids should load');
        done();
      });
    });
  });
});

test('create and update', function(assert) {
  var done = assert.async();
  assert.expect(2);
  run(function(){
    var record = store().createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function(record2) {
      set(record2, 'name', 'one and a half');

      record2.save().then(function(record3) {
        assert.ok(record3, 'Record was updated');
        assert.equal(get(record3, "name"), "one and a half", "updated property should be accepted");
        done();
      });
    });
  });

});

test('create find and update', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(2);
  run(function(){
    var record = store().createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(list1){
        list1.set('name', 'one and a half');

        list1.save().then(function(list2) {
          assert.ok(list2, 'Record was updated');
          assert.equal(get(list2, "name"), "one and a half", "updated property should be accepted");
          done();
        });
      });
    });

  });
});

test('create and multiple update', function(assert) {
  var done = assert.async();
  assert.expect(3);
  run(function(){
    var record = store().createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function(record2) {
      set(record2, 'name', 'one and a half');

      record2.save().then(function(record3) {
        assert.equal(get(record3, "name"), "one and a half", "updated property should be accepted");
        set(record3, 'name', 'two');

        record3.save().then(function(record4) {
          assert.ok(record4, 'Record was updated');
          assert.equal(get(record4, "name"), "two", "updated property should be accepted");
          done();
        });
      });
    });
  });
});

test('create and findAll', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var item = store().createRecord('item', { id: 'i1', name: 'one' });
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var record = store().createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([item.save(), list.save(), record.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll("list").then(function(lists) {
        assert.deepEqual(lists.mapBy('id'), ['l1', 'l2'], 'Records were loaded');
        done();
      });
    });
  });
});

test('create and findAll with hasMany', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(2);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store().createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('list').then(function(lists) {
        assert.equal(get(lists, 'length'), 1, 'findAll records should load');
        var items = get(lists, 'firstObject.items');
        assert.equal(get(items, 'length'), 1, 'hasMany items should load');
        done();
      });
    });
  });
});

test('create and findAll with async hasMany via array', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(2);
  run(function(){
    var item1 = store().createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    list.get('asyncItems').then(function(items){
      items.addObject(item1);
    }).then(function(){
      Ember.RSVP.all([list.save(), item1.save(), item2.save()]).then(function() {
        next.resolve();
      });
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('list').then(function(lists) {
        assert.equal(get(lists, 'length'), 1, 'findAll records should load');
        get(lists, 'firstObject.asyncItems').then(function(items){
          assert.equal(get(items, 'length'), 1, 'async hasMany items should load');
          done();
        });
      });
    });
  });
});

test('create and findAll with async belongsTo', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store().createRecord('item', { id: 'i1', name: 'one', asyncList: list });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });

    Ember.RSVP.all([list.save(), item1.save(), item2.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('item').then(function(items) {
        assert.equal(get(items, 'length'), 2, 'findAll records should load');
        get(items, 'firstObject.asyncList').then(function(list){
          assert.ok(list, 'async belongsTo item should load');
          assert.equal(get(list, 'id'), 'l1', 'async belongsTo item should have its initial properties');
          done();
        });
      });
    });
  });
});

test('create and findAll with async hasMany', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(4);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store().createRecord('item', { id: 'i1', name: 'one', asyncList: list });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });
    list.get('asyncItems').then(function(items){
      items.addObject(item1);
    }).then(function(){
      Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
        next.resolve();
      });
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('list').then(function(lists) {
        assert.equal(get(lists, 'length'), 1, 'findAll records should load');
        list = get(lists, 'firstObject');
        assert.equal(get(list, 'id'), 'l1', 'findAll items should load');
        get(list, 'asyncItems').then(function(items){
          assert.ok(items, 'async hasMany item should be valid');
          assert.equal(get(items, 'length'), 1, 'async hasMany item should load');
          done();
        });
      });
    });
  });
});

test('create and delete', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var record = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    record.save().then(function(){
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(record){
        record.destroyRecord().then(function(record) {
          assert.ok(record.get('isDeleted'), 'record should be marked as deleted');
          done();
        });
      });
    });
  });
});

test('create and query', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  Ember.run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([list1.save(), list2.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('list', {name: 'two'}).then(function(result) {
        assert.equal(get(result, 'type').modelName, 'list', 'query should look for the correct type');
        assert.equal(get(result, 'length'), 1, 'Record loaded');
        assert.equal(get(result, 'firstObject.name'), 'two', 'Wrong record loaded');
        done();
      });
    });
  });
});

test('create and query by id', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(4);
  run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([list1.save(), list2.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('list', {id: 'l2'}).then(function(result) {
        assert.equal(get(result, 'type').modelName, 'list', 'query should look for the correct type');
        assert.equal(get(result, 'length'), 1, 'Record should load');
        assert.equal(get(result, 'firstObject.name'), 'two', 'should return the right record');
        store().query('list', {_id: 'l1'}).then(function(result) {
          assert.equal(get(result, 'firstObject.name'), 'one', 'should return the right record');
          done();
        });
      });
    });
  });
});

test('create and query with hasMany', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store().createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('list', {name: 'one'}).then(function(lists) {
        assert.equal(get(lists, 'type').modelName, 'list', 'query should look for the correct type');
        assert.equal(get(lists, 'length'), 1, 'query record should load');
        var items = get(lists, 'firstObject.items');
        assert.equal(get(items, 'length'), 1, 'hasMany items should load');
        done();
      });
    });
  });
});

test('create and query using skip and limit', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(5);
  run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true});
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: false});
    var list3 = store().createRecord('list', { id: 'l3', name: 'three', b: true});
    var list4 = store().createRecord('list', { id: 'l4', name: 'four', b: false});

    Ember.RSVP.all([list1.save(), list2.save(), list3.save(), list4.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('list').then(function(lists){
        assert.equal(get(lists, 'length'), 4, 'should return all records without limit');
      }).then(function(){
        store().query('list', {_skip: 1, _limit: 2}).then(function(lists){
          assert.equal(get(lists, 'length'), 2, 'should limit results');
          assert.equal(get(lists, 'firstObject.id'), 'l2', 'should skip results');
          store().query('list', {_skip: 1, _limit: 2, b: true}).then(function(lists){
            assert.equal(get(lists, 'length'), 1, 'should left only one result');
            assert.equal(get(lists, 'firstObject.id'), 'l3', 'should skip results');
            done();
          });
        });
      });
    });
  });
});

test('create and query by first letter', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true, tags: ['one']});
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: false, tags: ['two']});
    var list3 = store().createRecord('list', { id: 'l3', name: 'three', b: true, tags: ['three']});
    var list4 = store().createRecord('list', { id: 'l4', name: 'four', b: false, tags: ['four']});

    Ember.RSVP.all([list1.save(), list2.save(), list3.save(), list4.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('list', {'tags[0][0]': 't'}).then(function(lists){
        assert.equal(get(lists, 'length'), 2, 'should find matching records');
        done();
      });
    });
  });
});

test('create and queryRecord', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(2);
  run(function(){
    var list1 = store().createRecord('list', { id: 'l1', name: 'one', b: true, tags: ['one']});
    var list2 = store().createRecord('list', { id: 'l2', name: 'two', b: false, tags: ['two']});
    var list3 = store().createRecord('list', { id: 'l3', name: 'three', b: true, tags: ['three']});
    var list4 = store().createRecord('list', { id: 'l4', name: 'four', b: false, tags: ['four']});

    Ember.RSVP.all([list1.save(), list2.save(), list3.save(), list4.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().queryRecord('list', {'b': true}).then(function(lists){
        assert.equal(get(lists, 'name'), "one", 'should find matching records');
        assert.equal(get(lists, 'b'), true, 'should find matching records');
        done();
      });
    });
  });
});

test('create with belongsTo changes another hasMany record', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test [step #1]"),
      next2 = Ember.RSVP.defer("pouchdb adapter test [step #2]");
  assert.expect(2);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true});
    var item1, item2;

    list.save().then(next.resolve);

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(list1){
        item1 = store().createRecord('item', { id: 'i1', name: 'one', list: list1});
        item2 = store().createRecord('item', { id: 'i2', name: 'two', list: list1});
        Ember.RSVP.all([item1.save(), item2.save()]).then(next2.resolve);
      });
    });

    next2.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(list){
        assert.equal(get(list, 'items.length'), 2, 'should have a relationship with both records');
        assert.deepEqual(get(list, 'items').mapBy("name"), ["one", "two"], 'should fetch the records');
        done();
      });
    });
  });
});

test('create with hasMany changes another belongsTo record', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test [step #1]"),
      next2 = Ember.RSVP.defer("pouchdb adapter test [step #2]");
  assert.expect(2);
  run(function(){
    var item1 = store().createRecord('item', { id: 'i1', name: 'one'});
    var item2 = store().createRecord('item', { id: 'i2', name: 'two'});
    var list;

    Ember.RSVP.all([item1.save(), item2.save()]).then(next.resolve);

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findByIds('item', ['i1', 'i2']).then(function(items){
        list = store().createRecord('list', { id: 'l1', name: 'one', b: true, items: items});
        list.save().then(next2.resolve);
      });
    });

    next2.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findByIds('item', ["i1", "i2"]).then(function(items){
        assert.equal(get(items, 'length'), 2, 'should load records');
        assert.deepEqual(items.mapBy("list.id"), ["l1", "l1"], 'should have the relationship applied');
        done();
      });
    });
  });
});

test('delete a record with belongsTo relationship', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test [step #1]"),
      next2 = Ember.RSVP.defer("pouchdb adapter test [step #2]");
  assert.expect(1);
  run(function(){
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store().createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });
    list.get('items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('item', 'i1').then(function(item){
        item.destroyRecord().then(function(){
          next2.resolve();
        });
      });
    });

    next2.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(list){
        assert.equal(get(list, 'items.length'), 0, 'deleted relationships should not appear');
        done();
      });
    });
  });
});

test('delete a record with hasMany relationship', function(assert) {
  var done = assert.async();
  var next1 = Ember.RSVP.defer("pouchdb adapter test [step #1]"),
      next2 = Ember.RSVP.defer("pouchdb adapter test [step #2]");
  assert.expect(1);
  run(function(){
    var item1 = store().createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    get(list, 'items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      next1.resolve();
    });

    next1.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('list', 'l1').then(function(list){
        list.destroyRecord().then(function(){
          next2.resolve();
        });
      });
    });

    next2.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().find('item', 'i1').then(function(item){
        assert.equal(get(item, 'list'), null, 'deleted relationship should not appear');
        done();
      });
    });
  });
});

test('change hasMany relationship', function(assert) {
  var done = assert.async();
  var next1 = Ember.RSVP.defer("pouchdb adapter test [step #1]"),
      next2 = Ember.RSVP.defer("pouchdb adapter test [step #2]");
  assert.expect(5);
  run(function(){
    var item1 = store().createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store().createRecord('item', { id: 'i2', name: 'two' });
    var list = store().createRecord('list', { id: 'l1', name: 'one', b: true });
    list.get('items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      next1.resolve();
    });

    next1.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      Ember.RSVP.hash({
        list: store().find('list', 'l1'),
        item2: store().find('item', 'i2')
      }).then(function(res){
        list = res.list;
        item2 = res.item2;
        assert.equal(list.get('items.firstObject.name'), 'one', "unchanged relationship should keep the original record");
        get(list, 'items').clear();
        get(list, 'items').pushObject(item2);

        list.save().then(function(){
          next2.resolve();
        });
      });
    });

    next2.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      Ember.RSVP.hash({
        list: store().find('list', 'l1'),
        item1: store().find('item', 'i1'),
        item2: store().find('item', 'i2')
      }).then(function(res){
        list = res.list;
        item1 = res.item1;
        item2 = res.item2;
        assert.equal(get(list, 'items.length'), 1, "replaced relationship shouldn't increase the size of the container");
        assert.equal(get(list, 'items.firstObject.name'), 'two', "replaced relationship should reflect the change");
        assert.equal(get(item1, 'list.id'), null, "old relationship shouldn't exist");
        assert.equal(get(item2, 'list.id'), 'l1', "new relationship should exist");
        done();
      });
    });
  });
});

test('create and find polymorphic hasMany relationship', function(assert) {
  var done = assert.async();
  var next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(3);
  run(function(){
    var group1 = store().createRecord('group', { id: 'g1', name: 'one' });
    var group2 = store().createRecord('group', { id: 'g2', name: 'two' });
    group1.get('children').pushObject(group2);

    Ember.RSVP.all([group1.save(), group2.save()]).then(function(){
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
      return store().find('group', 'g1');
    }).then(function(group){
      assert.equal(get(group, 'name'), 'one', 'find should return the record');
      assert.equal(get(group, 'children.length'), 1, 'polymorphic relationship should be loaded');
      assert.equal(get(group, "children.firstObject.constructor.modelName"), 'group', "polymorphic relationship shouldn't change the type");
      done();
    });
  });
});

// TODO: create and find polymorphic belongsTo relationship

test('create and find 1024 items', function(assert) {
  var done = assert.async(),
      next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.push(store().createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(){
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().findAll('item').then(function(items){
        assert.equal(items.get('length'), 1024, 'should find 1024 items');
        done();
      });
    });
  });
});

test('create and find 1024 items and skip 500 items', function(assert) {
  var done = assert.async(),
      next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.push(store().createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(){
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('item', {_skip: 500}).then(function(items){
        assert.equal(items.get('length'), 524, 'should find 524 items');
        done();
      });
    });
  });
});

test('create 1024 items, but find the first 100', function(assert) {
  var done = assert.async(),
      next = Ember.RSVP.defer("pouchdb adapter test");
  assert.expect(1);
  run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.push(store().createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(){
      next.resolve();
    });

    next.promise.then(function(){
      run(App, 'destroy');
      newApp();
    }).then(function(){
      store().query('item', {_limit: 100}).then(function(items){
        assert.equal(items.get('length'), 100, 'should find 100 items');
        done();
      });
    });
  });
});

