import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  rev: DS.attr('string'),
  list: DS.belongsTo('list', {inverse: 'items', async: false}),
  asyncList: DS.belongsTo('list', {async: true, inverse: 'asyncItems'})
});
