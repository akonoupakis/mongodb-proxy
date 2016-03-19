var util = require('util')
var EventEmitter = require('events').EventEmitter
var mongodb = require('mongodb')
var Store = require('./Store.js')
var jsonValidation = require('json-validation')
var Api = require('./Api.js')
var Cache = require('./Cache.js')
var Context = require('./Context.js')
var async = require('async')
var extend = require('extend')
var debug = require('debug')('mongodb-proxy')

var _ = require('underscore')
_.str = require('underscore.string')

var purgeCacheFn = function (sender, collection, context, data) {
  sender.cache.purge('db.' + collection, function (err, results) {
    if (err) context.error(err)
    else context.done()
  })
}

/**
 * The database instance
 * @constructor

 * @param {object} options - The options
 * @param {string} options.name - The name
 * @param {string} options.host - The hostname
 * @param {number} options.port - The port
 * @param {object} options.credentials - The user credentials
 * @param {string} options.credentials.user - The username
 * @param {string} options.credentials.password - The password

 * @property {object} options - The options
 * @property {string} options.name - The name
 * @property {string} options.host - The hostname
 * @property {number} options.port - The port
 * @property {object} options.credentials - The user credentials
 * @property {string} options.credentials.user - The username
 * @property {string} options.credentials.password - The password
 * @property {object} mdb - The mongodb driver database instance
 * @property {object} collections - The collections configured
 * @property {Cache} cache - The Cache provider
 * @property {object} events - The global events configured
 */
var Database = function (options) {
  EventEmitter.call(this)

  this.options = options
  this.mdb = new mongodb.Db(this.options.name, new mongodb.Server(this.options.host, this.options.port))

  this.collections = {}
  this.cache = new Cache()

  this.events = {
    preread: [],
    postread: [],
    precreate: [],
    postcreate: [purgeCacheFn],
    preupdate: [],
    postupdate: [purgeCacheFn],
    predelete: [],
    postdelete: [purgeCacheFn]
  }
}
util.inherits(Database, EventEmitter)

/**
 * Configure the proxy.

 * @param {function} options - The config function passing {@link DatabaseConfigProcessor} as an argument
 */
Database.prototype.configure = function (fn) {
  var processor = new DatabaseConfigProcessor(this)
  fn(processor)
}

/**
 * Create a store for a collection.

 * @param {string} name - The collection name
 * @param {HttpRequest} [req] - The http request object
 * @param {HttpResponse} [res] - The http response object
 * @param {boolean} [internal] - Whether the store is in internal mode or not
 * @returns {Store}
 */
Database.prototype.createStore = function (name, req, res, internal) {
  var store = new Store(this, name, req, res, internal)
  return store
}

/**
 * Create an api for the database

 * @param {HttpRequest} [req] - The http request object
 * @param {HttpResponse} [res] - The http response object
 * @param {boolean} [internal] - Whether the store is in internal mode or not
 * @returns {Api}
 */
Database.prototype.createApi = function (req, res, internal) {
  var api = new Api(this, req, res, internal)
  return api
}

/**
 * Handle an http incoming request

 * @param {Database~routeOptions} route - The request info
 * @param {Database~handleNextCallback} next - The next callback function (if the resource is not found)
 * @param {Database~handleCallback} cb - Whether the store is in internal mode or not
 */
Database.prototype.handle = function (route, next, cb) {
  /**
  * @callback Database~routeOptions
  * @param {string} method - The http method name
  * @param {string} collection - The collection name
  * @param {string} path - The path of the collection query (emit the collection name)
  * @param {string} query - The stringified query
  * @param {object} [data] - The posted data (if any)
  * @param {HttpRequest} [req] - The http request object
  * @param {HttpResponse} [res] - The http response object
  */

  /**
  * @callback Database~handleNextCallback
  */

  /**
  * @callback Database~handleCallback
  * @param {Exception} err - The exception object
  * @param {string} res - The results
  */

  var jv = new jsonValidation.JSONValidation()
  var validationResults = jv.validate(route, {
    type: 'object',
    required: true,
    properties: {
      method: { type: 'string', required: true },
      collection: { type: 'string', required: true },
      path: { type: 'string', required: true },
      query: { type: 'string' },
      data: { type: ['object', 'array'] },
      req: { type: 'object' },
      res: { type: 'object' }
    }
  })

  if (!validationResults.ok) {
    throw new Error(validationResults.errors.join(', ') + ' at path ' + validationResults.path)
  }

  var pathParts = _.str.trim(route.path, '/').split('/')
  var path = pathParts.length === 1 ? pathParts[0] : null

  var query
  if (path && path !== 'count') {
    query = path
  } else {
    if (route.query) {
      query = JSON.parse(route.query)
    }
  }

  var data = route.data

  var method = 'get'
  switch (route.method) {
    case 'GET':
      if (path === 'count') method = 'count'
      else method = 'get'
      break
    case 'POST':
      method = 'post'
      break
    case 'PUT':
      method = 'put'
      break
    case 'DELETE':
      method = 'del'
      break
    default:
      method = null
      break
  }

  if (method) {
    var api = this.createApi(route.req, route.res, false)

    if (api[route.collection]) {
      debug('http request %s %s', method.toUpperCase(), '/' + route.collection + route.path + (route.query ? '?q=' + encodeURIComponent(route.query) : ''))

      var args = []
      if (['get', 'count', 'put', 'del'].indexOf(method) !== -1) {
        args.push(query)
      }
      if (['post', 'put'].indexOf(method) !== -1) {
        args.push(data)
      }

      args.push(function (error, results) {
        if (error) {
          cb(error)
        } else {
          if (results) {
            cb(null, results)
          } else {
            next()
          }
        }
      })

      var col = api[route.collection]
      col[method].apply(col, args)
    } else {
      next()
    }
  } else {
    next()
  }
}

/**
 * Connect to the database.

 * @param {Database~connectCallback} cb - The callback function
 */
Database.prototype.connect = function (cb) {
  /**
  * @callback Database~connectCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The database instance
  */

  var db = this

  if (db.connected) {
    cb(null, db.mdb)
  } else if (db.connecting) {
    db.once('connection attempted', function (err) {
      cb(err, db.mdb)
    })
  } else {
    db.connecting = true
    db.mdb.open(function (err) {
      db.connecting = false
      db.emit('connection attempted', err)
      if (err) {
        db.connected = false
        cb(err)
      } else {
        var credentials = db.options.credentials
        if (credentials && credentials.username && credentials.password) {
          db.mdb.authenticate(credentials.username, credentials.password, function (err) {
            if (err) {
              db.connected = false
              cb(err)
            }
            db.connected = true
            cb(null, db.mdb)
          })
        } else {
          db.connected = true
          cb(null, db.mdb)
        }
      }
    })
  }
}

/**
 * Drop the database.

 * @param {Database~dropCallback} cb - The callback function
 */
Database.prototype.drop = function (cb) {
  /**
  * @callback CollectionApi~dropCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The drop result
  */

  this.connect(function (err, mdb) {
    if (err) {
      return cb(err)
    }

    mdb.open(function () {
      mdb.dropDatabase(cb)
    })
  })
}

Database.prototype.run = function (store, event, previousData, data, cb) {
  var self = this

  var error = function (err) {
    cb(err)
  }

  var done = function (response) {
    cb(null, response)
  }

  if (self.events[event]) {
    var newDocument = ['precreate', 'postcreate'].indexOf(event) !== -1
    var single = false
    var dataTaskIds = []
    var dataTasks = []

    var taskProcess = function (d, prev, tcb) {
      var eventTasks = []

      _.each(self.events[event], function (eventFn) {
        eventTasks.push(function (tcbb) {
          var context = new Context(store, d, prev, null, tcbb)

          if (event === 'preread' || event === 'precreate') {
            eventFn(self, store.name, context)
          } else {
            eventFn(self, store.name, context, d)
          }
        })
      })

      var nextIndex = 0
      var next = function (err, response) {
        if (err) {
          return tcb(err)
        }

        nextIndex++

        var eventTask = eventTasks[nextIndex]
        if (eventTask) {
          eventTask(next)
        } else {
          tcb(null, d)
        }
      }

      var first = _.first(eventTasks)
      if (first) {
        first(next)
      } else {
        tcb(null, d)
      }
    }

    if (_.isArray(data)) {
      _.each(data, function (d) {
        var prev = !newDocument ? (
          _.isArray(previousData) ? _.find(previousData, function (x) {
            return x.id === d.id
          }) : null) : null

        dataTasks.push(function (tcb) {
          taskProcess(d, prev, tcb)
        })

        if (!newDocument) {
          dataTaskIds.push(d.id)
        }

        single = false
      })
    } else if (_.isObject(data)) {
      dataTasks.push(function (tcb) {
        taskProcess(data, previousData, tcb)
      })

      if (!newDocument) {
        dataTaskIds.push(data.id)
      }

      single = true
    } else {
      dataTasks.push(function (tcb) {
        taskProcess(null, null, tcb)
      })
      single = true
    }

    if (dataTasks.length > 0) {
      async.parallel(dataTasks, function (err, results) {
        if (err) {
          return error(err)
        }

        var parsedResults = !newDocument ? _.map(dataTaskIds, function (r) {
          var dd = _.find(results, function (x) {
            return x.id === r
          })
          var ddd = single ? data : _.find(data, function (x) {
            return x.id === r
          })

          return dd || ddd
        }) : results

        return done(single ? _.first(parsedResults) : parsedResults)
      })
    } else {
      return done(data)
    }
  } else {
    return done(data)
  }
}

module.exports = Database

/**
 * The database config processor
 * @constructor

 * @param {Database} db - The database instance
 */
var DatabaseConfigProcessor = function (db) {
  this.db = db
}

/**
 * Register a collection.
 * @tutorial register-collection

 * @param {DatabaseConfigProcessor~registerObject} collection - The collection configuration object
 */
DatabaseConfigProcessor.prototype.register = function (collection) {
  var self = this

  /**
  * @callback DatabaseConfigProcessor~registerObject
  * @param {string} name - The collection name
  * @param {object} schema - The validation schema
  * @param {DatabaseConfigProcessor~registerEventsObject} events - The event modules for the collection
  */

  /**
  * @callback DatabaseConfigProcessor~registerEventsObject
  * @param {function} validate - The validate event
  * @param {function} get - The get event
  * @param {function} post - The post event
  * @param {function} put - The put event
  * @param {function} del - The del event
  * @param {function} resolve - The resolve event
  */

  var jv = new jsonValidation.JSONValidation()
  var validationResults = jv.validate(collection, {
    type: 'object',
    required: true,
    properties: {
      name: { type: 'string', required: true },
      schema: { type: 'object', required: false },
      events: {
        type: 'object', properties: {
          validate: { type: 'any' },
          get: { type: 'any' },
          post: { type: 'any' },
          put: { type: 'any' },
          del: { type: 'any' },
          resolve: { type: 'any' }
        }
      }
    }
  })

  if (!validationResults.ok) {
    throw new Error(validationResults.errors.join(', ') + ' at path ' + validationResults.path)
  }

  if (!self.db.collections[collection.name]) {
    self.db.collections[collection.name] = {
      name: collection.name,
      schema: {},
      scripts: {
        validate: [],
        get: [],
        post: [],
        put: [],
        del: [],
        resolve: []
      }
    }
  }

  if (collection.schema) {
    extend(true, self.db.collections[collection.name].schema, collection.schema)
  }

  if (collection.events) {
    for (var eventName in collection.events) {
      if (self.db.collections[collection.name].scripts[eventName]) {
        if (typeof (collection.events[eventName]) === 'function') {
          self.db.collections[collection.name].scripts[eventName].push(collection.events[eventName])
        }
      }
    }
  }
}

/**
 * Bind for a global event.
 * @tutorial bind-global-events

 * @param {string} name - The event name
 * @param {function} fn - The event function
 */
DatabaseConfigProcessor.prototype.bind = function (name, fn) {
  var self = this

  if (!name || !fn) return

  var eventNames = _.keys(self.db.events)

  if (eventNames.indexOf(name) === -1) {
    throw new Error('invalid bindable action. available are: ' + eventNames.join(','))
  }

  self.db.events[name].push(fn)
}

/**
 * Set the cache.
 * @tutorial set-cache
s
 * @param {Cache} cache - The cache instance
 */
DatabaseConfigProcessor.prototype.cache = function (cache) {
  this.db.cache = cache
}
