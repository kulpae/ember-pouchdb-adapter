
Ember.onerror = function(error){
  console.log("error:", error.stack || error);
  ok(false, error);
  start();
}

Ember.RSVP.configure('onerror', function(error) {
  console.log("error:", error.stack || error);
  ok(false, error);
  start();
});

function createApp(){
  return Ember.run(function(){
    var List = DS.Model.extend({
      name: DS.attr('string'),
      b: DS.attr('boolean'),
      tags: DS.attr(undefined, {defaultValue: []}),
      items: DS.hasMany('item', {inverse: 'list'}),
      asyncItems: DS.hasMany('item', {async: true, inverse: 'asyncList'})
    });

    var Item = DS.Model.extend({
      name: DS.attr('string'),
      list: DS.belongsTo('list', {inverse: 'items'}),
      asyncList: DS.belongsTo('list', {async: true, inverse: 'asyncItems'})
    });

    var Node = DS.Model.extend({
      name: DS.attr('string'),
    });

    var Group = Node.extend({
      children: DS.hasMany('node', {polymorphic: true})
    });

    var adapter = DS.PouchDBAdapter.extend({
      databaseName: 'ember-pouchdb-test'
    });


    var app = Ember.Application.create({
      List: List,
      Item: Item,
      Node: Node,
      Group: Group,
      ApplicationAdapter: adapter,
      ApplicationStore: DS.Store.extend({ isCustom: true })
    });

    app.setupForTesting();
    app.injectTestHelpers();

    return app;
  });
}

function destroyApp(app){
  return Ember.run(function(){
    app.destroy();
    Ember.BOOTED = false;
  });
}

function reset(app){
  return Ember.run(function(){
    destroyApp(app);
    return createApp();
  });
}

function store(app){
  return app.__container__.lookup("store:main");
}
