var util = require('util');
var EventEmitter = require('events').EventEmitter;
var mongodb = require('mongodb');
var Store = require('./Store.js');

var Database = function (options) {
    this.options = options;
    this.mdb = new mongodb.Db(this.options.name, new mongodb.Server(this.options.host, this.options.port));
};
util.inherits(Database, EventEmitter);

Database.prototype.createStore = function (name) {
    var store = new Store(this, name);
    return store;
};

Database.prototype.handle = function () {
    // handle incoming requests
};

Database.prototype.drop = function () {
    // drop db
};

module.exports = Database;