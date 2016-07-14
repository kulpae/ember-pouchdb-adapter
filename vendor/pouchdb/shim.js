/* globals PouchDB */
/* taken from
 * https://github.com/nolanlawson/ember-pouch/blob/master/vendor/ember-pouch/shim.js
 * */

define('pouchdb', [], function() {
    "use strict";

      return { 'default': PouchDB };
});