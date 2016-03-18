var extend = require('extend')
var _ = require('underscore')

/**
 * An api wrapper for all stores.
 * Useful if exposed to REST services, as it gets a merged options object with all query/fiels/options parts.
 * Foreach collection in the database, the api creates a {@link CollectionApi}.
 * @constructor

 * @param {Database} database - The database instance
 * @param {HttpRequest} req - The http request object
 * @param {HttpResponse} res - The http response object
 * @param {boolean} internal - Whether the store is in internal mode or not
 */
var Api = function (database, req, res, internal) {
  for (var collectionName in database.collections) {
    var collection = database.collections[collectionName]
    this[collection.name] = new CollectionApi(database, collection.name, req, res, internal)
  }
}

module.exports = Api

function stripFields (query) {
  if (!query) return
  var fields = query.$fields
  if (fields) delete query.$fields
  return fields
}

function stripOptions (query) {
  var options = {}
  if (!query) return options
  if (query.$limit) options.limit = query.$limit
  if (query.$skip) options.skip = query.$skip
  if (query.$sort || query.$orderby) options.sort = query.$sort || query.$orderby
  delete query.$limit
  delete query.$skip
  delete query.$sort
  return options
}

function stripSingle (query) {
  if (!query) return undefined
  var single = query.$single
  if (single !== undefined) {
    delete query.$single
    return single
  }

  return undefined
}

function stripCached (query) {
  if (!query) return undefined
  var cached = query.$cached
  if (cached !== undefined) {
    delete query.$cached
    return cached
  }
}

/**
 * An api wrapper for a single collection using internally a {@link Store}.
 * @constructor

 * @param {Database} database - The database instance
 * @param {string} name - The collection name.
 * @param {HttpRequest} req - The http request object
 * @param {HttpResponse} res - The http response object
 * @param {boolean} internal - Whether the collection Api is in internal mode or not

 * @property {Database} database - The database instance
 * @property {string} name - The collection name.
 * @property {HttpRequest} req - The http request object
 * @property {HttpResponse} res - The http response object
 * @property {boolean} internal - Whether the collection Api is in internal mode or not
 */
var CollectionApi = function (db, name, req, res, internal) {
  this.name = name
  this.db = db
  this.req = req
  this.res = res
  this.internal = internal
}

/**
 * Get data from the collection.

 * @param {object} query - The query
 * @param {CollectionApi~getCallback} cb - The callback function

 * @example
 * api.collection.get({
 *   firstName: 'John'
 *   $single: true,
 *   $cached: true,
 *   $fields: {
 *     firstName: 1,
 *     lastName: 1
 *   },
 *   $limit: 100,
 *   $sort: {
 *     firstName: 1
 *   }
 * }, function (err, res) {
 *   if(err)
 *      throw err

 * })
 */
CollectionApi.prototype.get = function (query, cb) {
  /**
  * @callback CollectionApi~getCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The results
  */

  var store = this.db.createStore(this.name, this.req, this.res, this.internal)
  store.get(function (x) {
    var fields = stripFields(query)
    var options = stripOptions(query)
    var single = stripSingle(query)
    var cached = stripCached(query)

    x.query(query)
    x.fields(fields)
    x.options(options)

    if (single) {
      x.single(single)
    }

    if (cached) {
      x.cached()
    }
  }, cb)
}

/**
 * Post new data to the collection.

 * @param {object} data - The data to post
 * @param {CollectionApi~postCallback} cb - The callback function

 * @example
 * api.collection.post({
 *   firstName: 'John',
 *   lastName: 'Smith'
 * }, function (err, res) {
 *   if(err)
 *      throw err

 * })
 */
CollectionApi.prototype.post = function (data, cb) {
  /**
  * @callback CollectionApi~postCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The posted results
  */

  var _data = _.isArray(data) ? _.map(data, function (x) { return extend(true, {}, x) }) : extend(true, {}, data)

  var store = this.db.createStore(this.name, this.req, this.res, this.internal)
  store.post(function (x) {
    x.data(_data)
  }, function (error, result) {
    if (error) {
      cb(error)
    } else {
      cb(null, {
        inserted: result
      })
    }
  })
}

/**
 * Update data in the collection.

 * @param {object} query - The query
 * @param {object} data - The data
 * @param {CollectionApi~putCallback} cb - The callback function

 * @example
 * api.collection.put({
 *   firstName: 'John',
 *   lastName: 'Smith'
 * }, {
 *   firstName: 'John2',
 *   lastName: 'Smith2'
 * }, function (err, res) {
 *   if(err)
 *      throw err

 * })
 */
CollectionApi.prototype.put = function (query, data, cb) {
  /**
  * @callback CollectionApi~putCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The update results
  */

  var _data = extend(true, {}, data)

  var store = this.db.createStore(this.name, this.req, this.res, this.internal)
  store.put(function (x) {
    x.query(query)
    x.data(_data)
  }, function (error, result) {
    if (error) {
      cb(error)
    } else {
      cb(null, {
        updated: result
      })
    }
  })
}

/**
 * Counts data from the collection.

 * @param {object} query - The query
 * @param {CollectionApi~countCallback} cb - The callback function

 * @example
 * api.collection.count({
 *   firstName: 'John',
 *   lastName: 'Smith'
 * }, function (err, res) {
 *   if(err)
 *      throw err

 * })
 */
CollectionApi.prototype.count = function (query, cb) {
  /**
  * @callback CollectionApi~countCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The count result
  */

  var store = this.db.createStore(this.name, this.req, this.res, this.internal)
  store.count(function (x) {
    x.query(query)
  }, function (error, result) {
    if (error) {
      cb(error)
    } else {
      cb(null, {
        count: result
      })
    }
  })
}

/**
 * Delete data from the collection.

 * @param {object} query - The query
 * @param {Store~delCallback} cb - The callback function

 * @example
 * api.collection.del({
 *   firstName: 'John',
 *   lastName: 'Smith'
 * }, function (err, res) {
 *   if(err)
 *      throw err

 * })
 */
CollectionApi.prototype.del = function (query, cb) {
  /**
  * @callback CollectionApi~delCallback
  * @param {Exception} err - The exception object
  * @param {object} res - The delete results
  */

  var store = this.db.createStore(this.name, this.req, this.res, this.internal)
  store.del(function (x) {
    x.query(query)
  }, function (error, result) {
    if (error) {
      cb(error)
    } else {
      cb(null, {
        deleted: result
      })
    }
  })
}
