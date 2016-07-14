import DS from 'ember-data';

export default DS.Model.extend({
  rev: DS.attr('string'),
  name: DS.attr('string'),
  b: DS.attr('boolean'),
  tags: DS.attr(undefined, {defaultValue: (()=> [])}),
  items: DS.hasMany('item', {inverse: 'list', async: false}),
  asyncItems: DS.hasMany('item', {async: true, inverse: 'asyncList'})
});
