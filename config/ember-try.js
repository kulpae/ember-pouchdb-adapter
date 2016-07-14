/*jshint node:true*/
module.exports = {
  scenarios: [
    {
      name: 'default',
      bower: {
        dependencies: { }
      }
    },
    {
      name: 'ember-1.13',
      bower: {
        dependencies: {
          'ember': '~1.13.0',
          'ember-data': '~1.13.0',
          'pouchdb': '5.1.0'
        },
        resolutions: {
          'ember': '~1.13.0',
          'ember-data': '~1.13.0',
          'pouchdb': '5.1.0'
        }
      }
    },
    {
      name: 'ember-release-pd5',
      bower: {
        dependencies: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '5.1.0'
        },
        resolutions: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '5.1.0'
        }
      }
    },
    {
      name: 'ember-release-pd4',
      bower: {
        dependencies: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '4.0.3'
        },
        resolutions: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '4.0.3'
        }
      }
    },
    {
      name: 'ember-release-pd3',
      bower: {
        dependencies: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '3.6.0'
        },
        resolutions: {
          'ember': 'release',
          'ember-data': 'release',
          'pouchdb': '3.6.0'
        }
      }
    },
    {
      name: 'ember-beta',
      bower: {
        dependencies: {
          'ember': 'beta',
          'ember-data': 'beta'
        },
        resolutions: {
          'ember': 'beta',
          'ember-data': 'beta'
        }
      }
    },
    {
      name: 'ember-canary',
      bower: {
        dependencies: {
          'ember': 'canary',
          'ember-data': 'canary'
        },
        resolutions: {
          'ember': 'canary',
          'ember-data': 'canary'
        }
      }
    }
  ]
};
