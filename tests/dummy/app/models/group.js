import DS from 'ember-data';
import Node from './node';

export default Node.extend({
  children: DS.hasMany('node', {polymorphic: true, async: true}),
  root: DS.belongsTo('node', {polymorphic: true, async: true})
});
