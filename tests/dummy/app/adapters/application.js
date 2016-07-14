import { Adapter as PouchDBAdapter } from 'ember-pouchdb-adapter';

export default PouchDBAdapter.extend({
  databaseName: "ember-test-db",
  batch_size: 100
});
