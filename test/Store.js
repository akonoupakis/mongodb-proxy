/* global describe,it */

var async = require('async')
var dbproxy = require('../lib/index.js')
var uuid = require('../lib/uuid.js')
var assert = require('assert')
var extend = require('extend')
var _ = require('underscore')

var dbConfig = {
  port: 43971,
  host: 'ds043971.mlab.com',
  name: 'heroku_6px9zt1b',
  credentials: {
    username: 'mongodbuser',
    password: 'mongodb'
  }
}

var testTimeout = 100000

var dataSchema = {
  type: 'object',
  required: true,
  properties: {
    title: {
      type: 'string',
      required: true
    },
    url: {
      type: 'string',
      required: true
    },
    date: {
      type: 'number',
      required: true
    },
    source: {
      type: 'string',
      required: true
    },
    description: {
      type: 'string',
      required: true
    }
  }
}

var dataObjects = [{
  id: '56b7e69f481a44b832f1313d',
  title: 'Brain wrinkles replicated in a jar',
  url: 'http://www.bbc.co.uk/news/health-35486047#sa-ns_mchannel=rss&ns_source=PublicRSS20-sa',
  date: 1454590286000,
  source: 'feeds.bbci.co.uk',
  description: 'Bereavement services for families whose babies are stillborn or die shortly after birth are \"not good enough\", a government health minister has said.'
}, {
  id: '56b7e69f481a44b832f1313f',
  title: 'Care in the UK: The costs you face',
  url: 'http://www.bbc.co.uk/news/science-environment-35438294#sa-ns_mchannel=rss&ns_source=PublicRSS20-sa',
  date: 1454348646000,
  source: 'feeds.bbci.co.uk',
  description: 'Scientists recreate the furrows of a human brain using a simple two-layered gel model, showing that the brain\'s folds have physical origins.'
}, {
  id: '56b7e69f481a44b832f13142',
  title: 'Hunt blamed for doctors\' low morale',
  url: 'http://www.bbc.co.uk/news/health-30990913#sa-ns_mchannel=rss&ns_source=PublicRSS20-sa',
  date: 1438099811000,
  source: 'feeds.bbci.co.uk',
  description: 'As we live longer and with council budgets tight, the care system that supports us in our later years is under increasing pressure. Find out the costs you might face.'
}]

var db = dbproxy.create(dbConfig)

db.configure(function (config) {
  config.register({
    name: 'articlesOne',
    schema: dataSchema,
    events: {
      put: function (sender, context, data) {
        if (context.changed('source')) {
          return context.error(401)
        }
        context.done()
      }
    }
  })
  config.register({
    name: 'articlesTwo',
    schema: dataSchema
  })
  config.register({
    name: 'articlesThree',
    schema: dataSchema,
    events: {
      get: function (sender, context, data) {
        return context.error(401)
      },
      post: function (sender, context, data) {
        return context.error(401)
      },
      put: function (sender, context, data) {
        return context.error(401)
      },
      del: function (sender, context, data) {
        return context.error(401)
      }
    }
  })
  config.register({
    name: 'articlesFour',
    schema: dataSchema
  })
  config.register({
    name: 'articlesFive',
    schema: dataSchema,
    events: {
      resolve: function (sender, context, data) {
        data.title = '!!'
        context.hide('description')
        context.done()
      }
    }
  })

  config.bind('preread', function (sender, collection, context) {
    if (collection === 'articlesTwo') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('postread', function (sender, collection, context) {
    if (collection === 'articlesFour') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('precreate', function (sender, collection, context) {
    if (collection === 'articlesTwo') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('postcreate', function (sender, collection, context) {
    if (collection === 'articlesFour') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('preupdate', function (sender, collection, context) {
    if (collection === 'articlesTwo') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('postupdate', function (sender, collection, context) {
    if (collection === 'articlesFour') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('predelete', function (sender, collection, context) {
    if (collection === 'articlesTwo') {
      return context.error(401)
    }
    context.done()
  })
  config.bind('postdelete', function (sender, collection, context) {
    if (collection === 'articlesFour') {
      return context.error(401)
    }
    context.done()
  })
})

describe('Store', function () {
  var purgeCollections = function (cb) {
    var tasks = []
    _.each(db.collections, function (collection) {
      tasks.push(function (cb) {
        var store = db.createStore(collection.name)
        store.getCollection(function (colErr, collection) {
          if (colErr) {
            return cb(colErr)
          }

          collection.remove({ }, function (err, result) {
            if (err) {
              return cb(err)
            }

            cb()
          })
        })
      })
    })

    async.series(tasks, function (err, res) {
      cb(err, res)
    })
  }

  describe('Preparing data', function () {
    it('should purge all collections', function (done) {
      this.timeout(testTimeout)
      purgeCollections(function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.ok('collections purged')
        }

        done()
      })
    })

    it('should populate all collections', function (done) {
      this.timeout(100000)
      var tasks = []

      _.each(db.collections, function (collection) {
        tasks.push(function (cb) {
          var store = db.createStore(collection.name)
          store.getCollection(function (colErr, collection) {
            if (colErr) {
              return cb(colErr)
            }

            var parsedDataObjects = _.map(dataObjects, function (x) {
              var cloned = extend(true, {}, x)
              cloned._id = uuid.create(x.id)
              delete cloned.id
              return cloned
            })

            collection.insert(parsedDataObjects, function (err, result) {
              if (err) {
                return cb(err)
              }

              cb()
            })
          })
        })
      })

      async.series(tasks, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.ok('collections populated')
        }

        done()
      })
    })
  })

  var getFn = function (collection, query, cb) {
    var store = db.createStore(collection)
    store.get(function (x) {
      x.query(query)
    }, cb)
  }

  describe('Store.get (single)', function () {
    it('should return 404', function (done) {
      this.timeout(testTimeout)
      getFn('articlesOne', '56b7e69f481a44b832f1313s', function (err, res) {
        if (err) {
          assert.ok(false, err.message)
        } else {
          assert.ok(res === null)
        }
        done()
      })
    })
    it('should return a single result', function (done) {
      this.timeout(testTimeout)
      getFn('articlesOne', '56b7e69f481a44b832f1313d', function (err, res) {
        if (err) {
          assert.ok(false, err.message)
        } else {
          assert.equal(true, res && res.id === '56b7e69f481a44b832f1313d')
        }
        done()
      })
    })
    it('should return 401 from db.preread event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesTwo', '56b7e69f481a44b832f1313d', function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.get event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesThree', '56b7e69f481a44b832f1313d', function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postread event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesFour', '56b7e69f481a44b832f1313d', function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return the result with altered result from store.resolve event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesFive', '56b7e69f481a44b832f1313d', function (err, res) {
        if (err) {
          assert.ok(false, err.message)
        } else {
          assert.equal('!!', res.title)
          assert.equal(undefined, res.description)
        }
        done()
      })
    })
  })

  describe('Store.get', function () {
    it('should return all results', function (done) {
      this.timeout(testTimeout)
      getFn('articlesOne', {}, function (err, res) {
        if (err) {
          assert.ok(false, err.message)
        } else {
          assert.equal(true, res && res.length === 3)
        }
        done()
      })
    })
    it('should return 401 from db.preread event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesTwo', {}, function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.get event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesThree', {}, function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postread event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesFour', {}, function (err, res) {
        if (err) {
          if (err.code === 401) {
            assert.ok(err.code)
          } else {
            assert.ok(false, err.message)
          }
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return results with altered result from store.resolve event', function (done) {
      this.timeout(testTimeout)
      getFn('articlesFive', {}, function (err, res) {
        if (err) {
          assert.ok(false, err.message)
        } else {
          assert.ok(_.all(res, function (x) { return x.title === '!!' && x.description === undefined }))
        }
        done()
      })
    })
  })

  describe('Store.post (single)', function () {
    var getNewObject = function () {
      var result = extend(true, {}, dataObjects[0])
      delete result.id
      return result
    }

    var deleteFromCollection = function (store, ids, cb) {
      store.getCollection(function (colErr, collection) {
        if (colErr) {
          return cb(colErr)
        }

        collection.remove({
          _id: {
            $in: ids
          }
        }, cb)
      })
    }

    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      var newObject = getNewObject()
      store.post(function (x) {
        x.data(newObject)
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else if (res) {
          assert.ok(res.id !== undefined)

          deleteFromCollection(store, [uuid.create(res.id)], function (delErr, delRes) {
            if (delErr) {
              assert.ok(false, delErr)
            }

            done()
          })
        } else {
          assert.ok(false)
          done()
        }
      })
    })

    it('should return 401 from db.precreate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      var newObject = getNewObject()
      store.post(function (x) {
        x.data(newObject)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 400 from schema validation error', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      var newObject = getNewObject()
      delete newObject.title
      store.post(function (x) {
        x.data(newObject)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 400)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.post event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      var newObject = getNewObject()
      store.post(function (x) {
        x.data(newObject)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postcreate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      var newObject = getNewObject()
      store.post(function (x) {
        x.data(newObject)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Store.post', function () {
    var getNewObjects = function () {
      var results = _.map(dataObjects, function (x) {
        var r = extend(true, {}, x)
        delete r.id
        return r
      })
      return results
    }

    var deleteFromCollection = function (store, ids, cb) {
      store.getCollection(function (colErr, collection) {
        if (colErr) {
          return cb(colErr)
        }

        collection.remove({
          _id: {
            $in: ids
          }
        }, cb)
      })
    }

    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      var newObjects = getNewObjects()
      store.post(function (x) {
        x.data(newObjects)
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else if (res) {
          assert.ok(res.length === 3)

          var postedIds = _.map(_.pluck(res, 'id'), function (x) { return uuid.create(x) })
          deleteFromCollection(store, postedIds, function (delErr, delRes) {
            if (delErr) {
              assert.ok(false, delErr)
            }

            done()
          })
        } else {
          assert.ok(false)
          done()
        }
      })
    })
    it('should return 401 from db.precreate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      var newObjects = getNewObjects()
      store.post(function (x) {
        x.data(newObjects)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 400 from schema validation error', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      var newObjects = _.map(getNewObjects(), function (x) {
        delete x.title
        return x
      })
      store.post(function (x) {
        x.data(newObjects)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 400)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.post event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      var newObjects = getNewObjects()
      store.post(function (x) {
        x.data(newObjects)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postcreate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      var newObjects = getNewObjects()
      store.post(function (x) {
        x.data(newObjects)
      }, function (err, res) {
        if (err) {
          assert.equal(err.code, 401)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Store.put (single)', function () {
    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          description: '!!'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else if (res) {
          assert.ok(res === 1)

          getFn('articlesOne', '56b7e69f481a44b832f1313d', function (getErr, getRes) {
            if (getErr) {
              assert.ok(false, getErr)
            } else {
              assert.equal('!!', getRes.description)
            }
            done()
          })
        } else {
          assert.ok(false)
          done()
        }
      })
    })
    it('should return 401 from db.preupdate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 400 from schema validation error', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          source: 123
        })
      }, function (err, res) {
        if (err) {
          assert.ok(400, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.put event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postupdate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 preventing changing a property', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query('56b7e69f481a44b832f1313d')
        x.data({
          source: '!!'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Store.put', function () {
    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query({
          description: {
            $ne: '!!'
          }
        })
        x.data({
          description: '!!'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else if (res) {
          assert.ok(res === 2)

          getFn('articlesOne', {
            description: '!!'
          }, function (getErr, getRes) {
            if (getErr) {
              assert.ok(false, getErr)
            } else {
              assert.equal(3, getRes.length)
            }
            done()
          })
        } else {
          assert.ok(false)
          done()
        }
      })
    })
    it('should return 401 from db.preupdate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      store.put(function (x) {
        x.query({
          source: 'feeds.bbci.co.uk'
        })
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 400 from schema validation error', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query({
          source: 'feeds.bbci.co.uk'
        })
        x.data({
          source: 123
        })
      }, function (err, res) {
        if (err) {
          assert.ok(400, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.put event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      store.put(function (x) {
        x.query({
          source: 'feeds.bbci.co.uk'
        })
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postupdate event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      store.put(function (x) {
        x.query({
          source: 'feeds.bbci.co.uk'
        })
        x.data({
          title: 'other title'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 preventing changing a property', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.put(function (x) {
        x.query({
          source: 'feeds.bbci.co.uk'
        })
        x.data({
          source: '!!'
        })
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Store.count', function () {
    it('should return count', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.count(function (x) { }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.equal(3, res)
        }
        done()
      })
    })
    it('should return count', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.count(function (x) {
        x.query({
          description: {
            $ne: '!!'
          }
        })
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.equal(0, res)
        }
        done()
      })
    })
  })

  describe('Store.del (single)', function () {
    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.del(function (x) {
        x.query('56b7e69f481a44b832f1313d')
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.equal(1, res)
        }
        done()
      })
    })
    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.del(function (x) {
        x.query('56b7e69f481a44b832f1313d')
      }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.equal(0, res)
        }
        done()
      })
    })
    it('should return 401 from db.predelete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      store.del(function (x) {
        x.query('56b7e69f481a44b832f1313d')
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.delete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      store.del(function (x) {
        x.query('56b7e69f481a44b832f1313d')
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postdelete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      store.del(function (x) {
        x.query('56b7e69f481a44b832f1313d')
      }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Store.del', function () {
    it('should return successful', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesOne')
      store.del(function (x) { }, function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.equal(2, res)
        }
        done()
      })
    })
    it('should return 401 from db.predelete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesTwo')
      store.del(function (x) { }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from store.delete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesThree')
      store.del(function (x) { }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
    it('should return 401 from db.postdelete event', function (done) {
      this.timeout(testTimeout)
      var store = db.createStore('articlesFour')
      store.del(function (x) { }, function (err, res) {
        if (err) {
          assert.ok(401, err.code)
        } else {
          assert.ok(false)
        }
        done()
      })
    })
  })

  describe('Destroying data', function () {
    it('should purge all collections', function (done) {
      this.timeout(testTimeout)
      purgeCollections(function (err, res) {
        if (err) {
          assert.ok(false, err)
        } else {
          assert.ok('collections purged')
        }

        done()
      })
    })
  })
})
