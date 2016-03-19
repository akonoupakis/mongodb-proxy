/**
 * A module to create a proxy instance
 * @module mongodb-proxy
 */

var Database = require('./Database.js')

/**
 * Create a proxy instance.

 * @tutorial getting-started

 * @param {object} options - The options
 * @param {string} options.name - The name
 * @param {string} options.host - The hostname
 * @param {number} options.port - The port
 * @param {object} options.credentials - The user credentials
 * @param {string} options.credentials.user - The username
 * @param {string} options.credentials.password - The password

 * @returns {Database}
 */
exports.create = function (options) {
  var db = new Database(options)
  return db
}
