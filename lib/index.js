/**
 * A module to create a proxy instance
 * @module mongodb-proxy
 */

var Database = require('./Database.js');

/**
 * Create a proxy instance.
 * 
 * @param {object} options - The options
 */
exports.create = function (options) {
    var db = new Database(options);
    return db;
};