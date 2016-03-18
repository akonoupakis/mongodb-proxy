/**
 * A module to create a proxy instance
 * @module mongodb-proxy
 */

var Database = require('./Database.js')

/**
 * Create a proxy instance.
 * @tutorial getting-started

 * @param {Database~options} options - The options
 * @returns {Database}
 */
exports.create = function (options) {
  var db = new Database(options)
  return db
}
