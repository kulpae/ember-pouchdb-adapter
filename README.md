
PouchDB 5.3.1 adapter for Ember Data 2.5.0
========================================

This Ember-Data adapter allows an Ember.js app with Ember-Data model
layer to store its data in PouchDB databases.

PouchDB makes it possible to synchronize the data with CouchDB and
keep the data on the client-side persistently, i.e. surviving browser refreshes
and restarts. PouchDB automatically detects available backends on the client, e.g.
IndexedDB, WebSQL or even LocalStorage and more.


This adapter will sideload non-async records and push them to the store. It is
not recommended to use syncroneus relationships though, just let the store
decide when to fetch the data asynchronously. This feature will be dropped, when
there are no syncronous relationships in Ember-Data anymore, as it is clumpy and
slow.

Usage
-----

Create a new adapter (e.g. ember g adapter application):

```javascript
import {Adapter as PouchDBAdapter} from 'ember-pouchdb-adapter';
import Ember from 'ember';

export default PouchDBAdapter.extend({
  databaseName: "my-local-db"
});
```

The models should define the properties ```id``` and ```rev``` as strings, at
least.

Future Plans
------------

* Support interoperability between many pouchdb databases and
  records in different adapters having the PouchDB serializer
* add batch save (when Ember-Data supports it)

## Running Tests

* `npm test` (Runs `ember try:testall` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`

Author
------

Paul Koch (kulpae)

http://uraniumlane.net

