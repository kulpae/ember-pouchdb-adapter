/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-pouchdb-adapter',

  included: function included(app) {
    var bowerDir = app.bowerDirectory;

    app.import(bowerDir + '/pouchdb/dist/pouchdb.js');
    app.import('vendor/pouchdb/shim.js', {
      type: 'vendor',
      exports: {
        'pouchdb': [ 'default' ]
      }
    });
  }
};
