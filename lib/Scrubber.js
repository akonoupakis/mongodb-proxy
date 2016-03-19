var ObjectScrubber = require('object-scrubber')
var uuid = require('./uuid.js')
var _ = require('underscore')

/**
 * An object scrubber for the proxy's internal use.
 * The scrubber is used to convert incoming object to mongodb friendly objects and vice versa.
 * @constructor
 */
var Scrubber = function () {}

/**
 * Converts to an incoming object

 * @param {object} object - The target object
 * @returns {object}
 */
Scrubber.prototype.inbound = function (object) {
  var scrubber = new ObjectScrubber()

  scrubber.when(function (x) {
    return x.parent && x.key === 'id'
  }, function (x) {
    x.parent._id = x.value
    delete x.parent.id
    x.key = '_id'

    if (_.isString(x.value) && uuid.isValid(x.value)) {
      x.parent._id = uuid.create(x.value)
    }
  })

  scrubber.when(function (x) {
    return _.isArray(x.value)
  }, function (x) {
    if (uuid.isValid(x.value)) {
      _.each(x.value, function (v, i) {
        if (v) {
          x.value[i] = uuid.create(v)
        }
      })
    } else {
      x.scrub(x.value)
    }
  })

  scrubber.when(function (x) {
    return _.isString(x.value) && uuid.isValid(x.value)
  }, function (x) {
    var uuidd = uuid.create(x.value)
    x.value = uuidd
    return uuidd
  })

  scrubber.when(function (x) {
    return !_.isArray(x.value) && _.isObject(x.value) && !uuid.isValid(x.value)
  }, function (x) {
    x.scrub(x.value)
  })

  var result = scrubber.scrub(object)
  return result
}

/**
 * Converts to an outgoing object

 * @param {object} object - The target object
 * @returns {object}
 */
Scrubber.prototype.outbound = function (object) {
  var scrubber = new ObjectScrubber()

  scrubber.when(function (x) {
    return x.parent && x.key === '_id'
  }, function (x) {
    x.parent.id = x.value
    delete x.parent._id
    x.key = 'id'

    if (!_.isArray(x.value) && uuid.isValid(x.value)) {
      x.parent.id = x.value.toString()
    }
  })

  scrubber.when(function (x) {
    return !_.isArray(x.value) && uuid.isValid(x.value) && x.value._bsontype
  }, function (x) {
    return x.value.toString()
  })

  scrubber.when(function (x) {
    return _.isArray(x.value)
  }, function (x) {
    if (_.all(x.value, function (a) { return uuid.isValid(a) })) {
      _.each(x.value, function (v, i) {
        if (v) {
          x.value[i] = v.toString()
        }
      })
    } else {
      x.scrub(x.value)
    }
  })

  scrubber.when(function (x) {
    return !_.isArray(x.value) && _.isObject(x.value) && !uuid.isValid(x.value)
  }, function (x) {
    x.scrub(x.value)
  })

  var result = scrubber.scrub(object)
  return result
}

module.exports = Scrubber
