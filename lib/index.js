var Database = require('./database.js');

exports.create = function (options) {
    var db = new Database(options);
    return db;
};