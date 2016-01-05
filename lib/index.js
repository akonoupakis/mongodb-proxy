var Database = require('./Database.js');

exports.create = function (options) {
    var db = new Database(options);
    return db;
};