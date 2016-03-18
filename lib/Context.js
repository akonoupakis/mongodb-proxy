var Exception = require('./Exception.js')
var jsonValidation = require('json-validation')
var objectSearch = require('object-search')
var uuid = require('./uuid.js')
var _ = require('underscore')

/**
 * The data context passing within local and global events.
 * @constructor

 * @tutorial register-collection
 * @tutorial bind-global-events

 * @param {Store} store - The store
 * @param {object} data - The data
 * @param {object} previous - The previous data
 * @param {object} raw - The raw data entered
 * @param {Context~callback} cb - The callback function

 * @property {boolean} internal - Whether the underlying Store is in internal mode or not
 * @property {Store} store - The store
 * @property {HttpRequest} req - The http request object
 * @property {HttpResponse} res - The http response object
 * @property {object} data - The data
 * @property {object} previous - The previous data
 * @property {object} raw - The raw data entered
 */
var Context = function (store, data, previous, raw, callback) {
  /**
   * @callback Context~callback
   * @param {Exception} err - The exception object
   * @param {object} res - The delete results
   */

  this.internal = store.internal
  this.store = store
  this.req = store.req
  this.res = store.res
  this.data = data
  this.previous = previous
  this.raw = raw
  this.callback = callback
}

/**
 * Throw an error and halt the process.

 * @param {number|string|object} code - The error status code or the error object
 * @param {string|object} err - The error object or message
 */
Context.prototype.error = function (code, err) {
  var message = err || code
  var resultCode = _.isNumber(code) ? code : 400

  this.callback(new Exception(resultCode, message))
}

/**
 * Complete the process.
 */
Context.prototype.done = function () {
  this.callback(null, this.data)
}

/**
 * Check if a property value has changed.

 * @param {string} name - The property name
 * @returns {boolean}
 */
Context.prototype.changed = function (property) {
  var source = objectSearch.get(this.previous, property)
  var target = objectSearch.get(this.data, property)

  return !_.isEqual(source, target)
}

/**
 * Hide a property from the resulting data.

 * @param {string} name - The property name
 */
Context.prototype.hide = function (property) {
  if (this.data) {
    delete this.data[property]
  }
}

/**
 * Validate the data against a json schema.

 * @param {object} schema - The validation schema
 * @returns {object}
 */
Context.prototype.validate = function (schema) {
  var validator = new jsonValidation.JSONValidation()

  validator.validateObjectId = function (obj, schema, errors) {
    if (obj === '') {
      return true
    }

    if (!_.isArray(obj) && _.isObject(obj) && uuid.isValid(obj)) {
      return true
    } else {
      errors.push('Object is invalid mongo uuid: ' + obj)
      return false
    }
  }

  var validationResult = validator.validate(this.data, schema)
  if (!validationResult.ok) {
    var validationErrors = { }
    validationErrors[validationResult.path] = validationResult.errors
    return validationErrors
  }
}

module.exports = Context
