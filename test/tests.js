// global variables
var App,
    list, lists,
    item, items;

module('DS.PouchDBAdapter', {

  setup: function() {
    App = createApp();
  },

  teardown: function() {
    stop();
    adapter(App)._getDb().then(function(db) {
      db.destroy().then(function(){
        destroyApp(App);
        start();
      });
    });
  }

});

test('existence', function() {
  expect(1);
  ok(PouchDBAdapter, 'PouchDBAdapter should exist');
});

asyncTest('error reporting', function() {
  expect(1);
  Ember.run(function(){
    //provoke an error by inserting a doc with the same pouch id, so that
    //a "document update conflict" occurs
    adapter(App)._getDb().then(function(db){
      db.put({
        "_id": 'list_l2'
      }).then(function(){
        Ember.run(function(){
          var record = store(App).createRecord('list', { id: 'l2', name: 'two', b: true});
          record.save().then(function() {
            ok(false, 'should have thrown an error');
          }, function(err){
            ok(true, 'has thrown an error as intended');
          }).finally(function(){
            record.destroy();
            start();
          });
        });
      });
    });
  });
});

asyncTest('create and find', function() {
  expect(1);
  Ember.run(function(){
    var record1 = store(App).createRecord('list', { id: 'l2', name: 'two', b: true});
    var record2 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });

    Ember.RSVP.all([record1.save(), record2.save()]).then(function() {
      App = reset(App);

      store(App).find('list', 'l1').then(function(list) {
        equal(list.get('name'), 'one', 'Record loaded');
        start();
      });
    });
  });
});

asyncTest('create and find different models with same id', function() {
  expect(2);
  Ember.run(function(){
    var record1 = store(App).createRecord('list', { id: 'o1', name: 'two', b: true});

    var record2 = store(App).createRecord('item', { id: 'o1', name: 'one', list: record1 });

    Ember.RSVP.all([record1.save(), record2.save()]).then(function() {
      App = reset(App);

      store(App).find('list', 'o1').then(function(list) {
        equal(list.get('name'), 'two', 'List record should load');
        store(App).find('item', 'o1').then(function(item) {
          equal(item.get('name'), 'one', 'Item record should load');
          start();
        });
      });
    });
  });
});

asyncTest('create with generated id', function() {
  expect(1);
  Ember.run(function(){
    var record = store(App).createRecord('list', { name: 'one' });

    record.save().then(function(response) {
      ok(response.get('id').length === 36, 'UUID assigned');
      start();
    });
  });

});

asyncTest('create and find with hasMany', function() {
  expect(1);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store(App).createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      App = reset(App);

      store(App).find('list', 'l1').then(function(list) {
        var items = list.get('items');
        equal(items.get('length'), 1, 'hasMany items should load');
        start();
      });
    });
  });
});

asyncTest('create and find with belongsTo', function() {
  expect(2);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store(App).createRecord('item', { id: 'i1', name: 'one', list: list});

    Ember.RSVP.all([list.save(), item.save()]).then(function() {
      App = reset(App);

      store(App).find('item', 'i1').then(function(item) {
        var list = item.get('list');
        ok(list, 'belongsTo item should load');
        equal(list && list.get('id'), 'l1', 'belongsTo item should have its initial properties');
        start();
      });
    });
  });
});

asyncTest('create and find with async belongsTo', function() {
  expect(2);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store(App).createRecord('item', { id: 'i1', name: 'one', asyncList: list});

    Ember.RSVP.all([list.save(), item.save()]).then(function() {
      App = reset(App);

      store(App).find('item', 'i1').then(function(item) {
        item.get('asyncList').then(function(list){
          ok(list, 'belongsTo item should load');
          equal(list && list.get('id'), 'l1', 'belongsTo item should have its initial properties');
          start();
        });
      });
    });
  });
});

asyncTest('create and findMany', function() {
  expect(1);
  Ember.run(function(){
    var list1 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store(App).createRecord('list', { id: 'l2', name: 'two', b: true });
    var list3 = store(App).createRecord('list', { id: 'l3', name: 'three', b: true });

    Ember.RSVP.all([list1.save(), list2.save(), list3.save()]).then(function() {
      App = reset(App);

      store(App).findByIds('list', ['l1', 'l3']).then(function(lists){
        deepEqual(lists.mapBy('id'), ['l1', 'l3'], 'records with ids should load');
        start();
      });

    });
  });
});

asyncTest('create and update', function() {
  expect(1);
  Ember.run(function(){
    var record = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function(record2) {
      record2.set('name', 'one and a half');

      record2.save().then(function(record3) {
        ok(true, 'Record was updated');
        start();
      });
    });
  });

});

asyncTest('create find and update', function() {
  expect(1);
  Ember.run(function(){
    var record = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function() {
      App = reset(App);

      store(App).find('list', 'l1').then(function(list){
        list.set('name', 'one and a half');

        list.save().then(function() {
          ok(true, 'Record was updated');
          start();
        });
      });
    });

  });
});

asyncTest('create and multiple update', function() {
  expect(1);
  Ember.run(function(){
    var record = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });

    record.save().then(function(record2) {
      record2.set('name', 'one and a half');

      record2.save().then(function(record3) {
        record3.set('name', 'two');

        record3.save().then(function(record4) {
          ok(true, 'Record was updated');
          start();
        });
      });
    });
  });
});

asyncTest('create and findAll', function() {
  expect(1);
  Ember.run(function(){
    item = store(App).createRecord('item', { id: 'i1', name: 'one' });
    list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var record = store(App).createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([item.save(), list.save(), record.save()]).then(function() {
      App = reset(App);

      store(App).find("list").then(function(lists) {
        deepEqual(lists.mapBy('id'), ['l1', 'l2'], 'Records were loaded');
        start();
      });
    });
  });
});

asyncTest('create and findAll with hasMany', function() {
  expect(2);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store(App).createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      App = reset(App);

      store(App).findAll('list').then(function(lists) {
        equal(lists.get('length'), 1, 'findAll records should load');
        var items = Ember.get(lists, 'firstObject.items');
        equal(items.get('length'), 1, 'hasMany items should load');
        start();
      });
    });
  });
});

asyncTest('create and findAll with async hasMany via array', function() {
  expect(2);
  Ember.run(function(){
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    list.get('asyncItems').then(function(items){
      items.addObject(item1);
    }).then(function(){

      Ember.RSVP.all([list.save(), item1.save(), item2.save()]).then(function() {
        App = reset(App);

        store(App).findAll('list').then(function(lists) {
          equal(lists.get('length'), 1, 'findAll records should load');
          Ember.get(lists, 'firstObject.asyncItems').then(function(items){
            equal(items.get('length'), 1, 'async hasMany items should load');
            start();
          });
        });
      });
    });
  });
});

asyncTest('create and findAll with async belongsTo', function() {
  expect(3);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one', asyncList: list });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });

    Ember.RSVP.all([list.save(), item1.save(), item2.save()]).then(function() {
      App = reset(App);

      store(App).findAll('item').then(function(items) {
        equal(items.get('length'), 2, 'findAll records should load');
        Ember.get(items, 'firstObject.asyncList').then(function(list){
          ok(list, 'async belongsTo item should load');
          equal(list && list.get('id'), 'l1', 'async belongsTo item should have its initial properties');
          start();
        });
      });
    });
  });
});

asyncTest('create and findAll with async hasMany', function() {
  expect(4);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one', asyncList: list });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });
    list.get('asyncItems').then(function(items){
      items.addObject(item1);
    }).then(function(){

      Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
        App = reset(App);

        store(App).findAll('list').then(function(lists) {
          equal(lists.get('length'), 1, 'findAll records should load');
          list = Ember.get(lists, 'firstObject');
          equal(list && list.get('id'), 'l1', 'findAll items should load');
          list.get('asyncItems').then(function(items){
            ok(items, 'async hasMany item should be valid');
            equal(items.get('length'), 1, 'async hasMany item should load');
            start();
          });
        });
      });
    });
  });
});

asyncTest('create and delete', function() {
  expect(1);
  Ember.run(function(){
    var record = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    record.save().then(function(){
      App = reset(App);
      store(App).find('list', 'l1').then(function(record){
        record.destroyRecord().then(function(record) {
          ok(record.get('isDeleted'), 'record should be marked as deleted');
          start();
        });
      });
    });
  });
});

asyncTest('create and findQuery', function() {
  expect(3);
  Ember.run(function(){
    var list1 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store(App).createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([list1.save(), list2.save()]).then(function() {
      App = reset(App);

      store(App).find('list', {name: 'two'}).then(function(result) {
        equal(result.get('type').typeKey, 'list', 'findQuery should look for the correct type');
        equal(result.get('length'), 1, 'Record loaded');
        equal(Ember.get(result, 'firstObject.name'), 'two', 'Wrong record loaded');
        start();
      });
    });
  });
});

asyncTest('create and findQuery by id', function() {
  expect(4);
  Ember.run(function(){
    var list1 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var list2 = store(App).createRecord('list', { id: 'l2', name: 'two', b: false });

    Ember.RSVP.all([list1.save(), list2.save()]).then(function() {
      App = reset(App);

      store(App).find('list', {id: 'l2'}).then(function(result) {
        equal(result.get('type').typeKey, 'list', 'findQuery should look for the correct type');
        equal(result.get('length'), 1, 'Record should load');
        equal(Ember.get(result, 'firstObject.name'), 'two', 'should return the right record');
        store(App).find('list', {_id: 'l1'}).then(function(result) {
          equal(Ember.get(result, 'firstObject.name'), 'one', 'should return the right record');
          start();
        });
      });
    });
  });
});

asyncTest('create and findQuery with hasMany', function() {
  expect(3);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item = store(App).createRecord('item', { id: 'i1', name: 'one', list: list });

    Ember.RSVP.all([item.save(), list.save()]).then(function() {
      App = reset(App);

      store(App).find('list', {name: 'one'}).then(function(lists) {
        equal(lists.get('type').typeKey, 'list', 'findQuery should look for the correct type');
        equal(lists.get('length'), 1, 'findQuery record should load');
        var items = Ember.get(lists, 'firstObject.items');
        equal(items.get('length'), 1, 'hasMany items should load');
        start();
      });
    });
  });
});

asyncTest('create and findQuery using skip and limit', function() {
  expect(5);
  Ember.run(function(){
    var list1 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true});
    var list2 = store(App).createRecord('list', { id: 'l2', name: 'two', b: false});
    var list3 = store(App).createRecord('list', { id: 'l3', name: 'three', b: true});
    var list4 = store(App).createRecord('list', { id: 'l4', name: 'four', b: false});

    Ember.RSVP.all([list1.save(), list2.save(), list3.save(), list4.save()]).then(function() {
      App = reset(App);
      store(App).find('list').then(function(lists){
        equal(Ember.get(lists, 'length'), 4, 'should return all records without limit');
      }).then(function(){
        store(App).find('list', {_skip: 1, _limit: 2}).then(function(lists){
          equal(Ember.get(lists, 'length'), 2, 'should limit results');
          equal(Ember.get(lists, 'firstObject.id'), 'l2', 'should skip results');
          store(App).find('list', {_skip: 1, _limit: 2, b: true}).then(function(lists){
            equal(Ember.get(lists, 'length'), 1, 'should left only one result');
            equal(Ember.get(lists, 'firstObject.id'), 'l3', 'should skip results');
            start();
          });
        });
      });
    });
  });
});

asyncTest('create and findQuery by first letter', function() {
  expect(1);
  Ember.run(function(){
    var list1 = store(App).createRecord('list', { id: 'l1', name: 'one', b: true, tags: ['one']});
    var list2 = store(App).createRecord('list', { id: 'l2', name: 'two', b: false, tags: ['two']});
    var list3 = store(App).createRecord('list', { id: 'l3', name: 'three', b: true, tags: ['three']});
    var list4 = store(App).createRecord('list', { id: 'l4', name: 'four', b: false, tags: ['four']});

    Ember.RSVP.all([list1.save(), list2.save(), list3.save(), list4.save()]).then(function() {
      App = reset(App);
      store(App).find('list', {'tags[0][0]': 't'}).then(function(lists){
        equal(Ember.get(lists, 'length'), 2, 'should find matching records');
        start();
      });
    });
  });
});

asyncTest('delete a record with belongsTo relationship', function() {
  expect(1);
  Ember.run(function(){
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });
    list.get('items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      App = reset(App);
      store(App).find('item', 'i1').then(function(item){
        item.destroyRecord().then(function(){
          App = reset(App);

          store(App).find('list', 'l1').then(function(list){
            equal(list.get('items.length'), 0, 'deleted relationships should not appear');
            start();
          });
        });
      });
    });
  });
});

asyncTest('delete a record with hasMany relationship', function() {
  expect(1);
  Ember.run(function(){
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    list.get('items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      App = reset(App);
      store(App).find('list', 'l1').then(function(list){
        list.destroyRecord().then(function(){
          App = reset(App);

          store(App).find('item', 'i1').then(function(item){
            equal(item.get('list'), null, 'deleted relationship should not appear');
            start();
          });
        });
      });
    });
  });
});

asyncTest('change hasMany relationship', function() {
  expect(4);
  Ember.run(function(){
    var item1 = store(App).createRecord('item', { id: 'i1', name: 'one' });
    var item2 = store(App).createRecord('item', { id: 'i2', name: 'two' });
    var list = store(App).createRecord('list', { id: 'l1', name: 'one', b: true });
    list.get('items').pushObject(item1);

    Ember.RSVP.all([item1.save(), item2.save(), list.save()]).then(function() {
      App = reset(App);

      Ember.RSVP.hash({
        list: store(App).find('list', 'l1'),
        item2: store(App).find('item', 'i2')
      }).then(function(res){
        list = res.list;
        item2 = res.item2;
        equal(list.get('items.firstObject.name'), 'one', "unchanged relationship should keep the original record");
        list.get('items').clear();
        list.get('items').pushObject(item2);

        list.save().then(function(){
          App = reset(App);

          Ember.RSVP.hash({
            list: store(App).find('list', 'l1'),
            item1: store(App).find('item', 'i1'),
            item2: store(App).find('item', 'i2')
          }).then(function(res){
            list = res.list;
            item1 = res.item1;
            item2 = res.item2;
            equal(list.get('items.firstObject.name'), 'two', "changed relationship should reflect the change");
            equal(item1.get('list.id'), null, "old relationship shouldn't exist");
            equal(item2.get('list.id'), 'l1', "new relationship should exist");
            start();
          });
        });
      });
    });
  });
});

asyncTest('create and find polymorphic relationship', function() {
  expect(3);
  Ember.run(function(){
    var group1 = store(App).createRecord('group', { id: 'g1', name: 'one' });
    var group2 = store(App).createRecord('group', { id: 'g2', name: 'two' });
    group1.get('children').pushObject(group2);

    Ember.RSVP.all([group1.save(), group2.save()]).then(function(res){
      App = reset(App);
      store(App).find('group', 'g1').then(function(group){
        equal(group.get('name'), 'one', 'find should return the record');
        equal(group.get('children.length'), 1, 'polymorphic relationship should be loaded');
        equal(group.get("children.firstObject.constructor.typeKey"), App.Group.typeKey, "polymorphic relationship shouldn't change the type");
        start();
      });
    });
  });
});

asyncTest('create and find 1024 items', function() {
  expect(1);
  Ember.run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.addObject(store(App).createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(res){
      App = reset(App);
      store(App).find('item').then(function(items){
        equal(items.get('length'), 1024, 'should find 1024 items');
        start();
      });
    });
  });
});

asyncTest('create and find 1024 items and skip 500 items', function() {
  expect(1);
  Ember.run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.addObject(store(App).createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(res){
      App = reset(App);
      store(App).find('item', {_skip: 500}).then(function(items){
        equal(items.get('length'), 524, 'should find 524 items');
        start();
      });
    });
  });
});

asyncTest('create 1024 items, but find the first 100', function() {
  expect(1);
  Ember.run(function(){
    var items = [];
    for(var i = 0; i < 1024; i++){
      items.addObject(store(App).createRecord('item', { id: 'i'+i, name: 'item'+i }));
    }
    items.reduce(function(p, n){
      return p.then(function(){
        return n.save();
      });
    }, Ember.RSVP.resolve()).then(function(res){
      App = reset(App);
      store(App).find('item', {_limit: 100}).then(function(items){
        equal(items.get('length'), 100, 'should find 100 items');
        start();
      });
    });
  });
});
