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

Database.prototype.connect = function(cb) {
    var db = this;

    if (db.connected) {
        cb(null, db.mdb);
    } else if (db.connecting) {
        db.once('connection attempted', function (err) {
            cb(err, db.mdb);
        });
    } else {
        db.connecting = true;
        db.mdb.open(function (err) {
            db.connecting = false;
            db.emit('connection attempted', err);
            if (err) {
                db.connected = false;
                cb(err);
            } else {
                var credentials = db.options.credentials;
                if (credentials && credentials.username && credentials.password) {
                    db.mdb.authenticate(credentials.username, credentials.password, function (err) {
                        if (err) {
                            db.connected = false;
                            cb(err);
                        }
                        db.connected = true;
                        cb(null, db.mdb);
                    });
                } else {
                    db.connected = true;
                    cb(null, db.mdb);
                }
            }
        });
    }

}

module.exports = Database;