var util = require('util');
var EventEmitter = require('events').EventEmitter;
var mongodb = require('mongodb');
var Store = require('./Store.js');
var jsonValidation = require('json-validation');
var Api = require('./Api.js');
var Cache = require('./Cache.js');

var _ = require('underscore');
_.str = require('underscore.string');

var purgeCacheFn = function (sender, collection, data, cb) {
    sender.cache.purge('db.' + collection, function (err, results) {
        cb(err);
    });
};

var Database = function (options) {
    EventEmitter.call(this);

    this.options = options;
    this.mdb = new mongodb.Db(this.options.name, new mongodb.Server(this.options.host, this.options.port));

    this.collections = {};
    this.cache = new Cache();

    this.events = {
        preread: [],
        postread: [],
        precreate: [],
        postcreate: [purgeCacheFn],
        preupdate: [],
        postupdate: [purgeCacheFn],
        predelete: [],
        postdelete: [purgeCacheFn]
    };
};
util.inherits(Database, EventEmitter);

Database.prototype.configure = function (fn) {
    var self = this;

    var processor = {
        register: function (collection) {
            var jv = new jsonValidation.JSONValidation();
            var validationResults = jv.validate(collection, {
                type: 'object',
                required: true,
                properties: {
                    name: { type: 'string', required: true },
                    schema: { type: 'object', required: false },
                    scripts: {
                        type: 'object', properties: {
                            validate: { type: 'string' },
                            get: { type: 'string' },
                            post: { type: 'string' },
                            put: { type: 'string' },
                            del: { type: 'string' }
                        }
                    }
                }
            });

            if (!validationResults.ok)
                throw new Error(validationResults.errors.join(", ") + " at path " + validationResults.path);

            self.collections[collection.name] = collection;
        },

        cache: function (cache) {
            self.cache = cache;
        }
    };
  
    fn(processor);
};

Database.prototype.createStore = function (name) {
    var store = new Store(this, name);
    return store;
};

Database.prototype.createApi = function (internal) {
    var api = new Api(this, internal || true);
    return api;
};

Database.prototype.handle = function (route, next, cb) {

    var jv = new jsonValidation.JSONValidation();
    var validationResults = jv.validate(route, {
        type: 'object',
        required: true,
        properties: {
            method: { type: 'string', required: true },
            collection: { type: 'string', required: true },
            path: { type: 'string', required: true },
            query: { type: 'string' },
            data: { type: 'object' }
        }
    });

    if (!validationResults.ok)
        throw new Error(validationResults.errors.join(", ") + " at path " + validationResults.path);

    var pathParts = _.str.trim(route.path, '/').split('/');
    var path = pathParts.length === 1 ? pathParts[0] : null;

    var query = undefined;
    if (path && path !== 'count') {
        query = path;
    }
    else {
        if (route.query) {
            query = JSON.parse(route.query);
        }
    }
    
    var data = route.data;

    var method = 'get';
    switch (route.method) {
        case 'GET':
            if (path === 'count')
                method = 'count';
            else
                method = 'get';
            break;
        case 'POST':
            method = 'post';
            break;
        case 'PUT':
            method = 'put';
            break;
        case 'DELETE':
            method = 'del';
            break;
        default:
            method = null;
            break;
    }

    if (method) {
        var api = this.createApi(false);

        if (api[route.collection]) {
            var args = [];
            if (['get', 'count', 'put', 'del'].indexOf(method) !== -1)
                args.push(query);
            if (['post', 'put'].indexOf(method) !== -1)
                args.push(data);

            args.push(function (error, results) {
                if (error) {
                    cb(error);
                }
                else {
                    if (results) {
                        cb(null, results);
                    }
                    else {
                        next();
                    }
                }
            });

            var col = api[route.collection];
            col[method].apply(col, args);
        }
        else {
            next();
        }
    }
    else {
        next();
    }

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

Database.prototype.drop = function (cb) {
    this.connect(function (err, mdb) {
        mdb.open(function () {
            mdb.dropDatabase(cb);
        });
    });
};

Database.prototype.bind = function (name, fn) {
    if (!name || !fn)
        return;

    var eventNames = _.keys(this.events);

    if (eventNames.indexOf(name) === -1)
        throw new error('invalid bindable action. available are: ' + eventNames.join(','));

    this.events.push(fn);
}

Database.prototype.run = function (event, collection, data, cb) {

    var runPreEvent = function (ev, col, obj, callback) {
        //if (db.events[event]) {
        //    if (event === 'preread' || event === 'precreate')
        //        db.events[event](server, scriptContext, collection, callback);
        //    else
        //        db.events[event](server, scriptContext, collection, object, callback);
        //}
        //else {
        //    callback();
        //}

        callback(null, obj);
    };

    var runPostEvent = function (ev, col, obj, callback) {
        //if (db.events[event]) {
        //    db.events[event](server, scriptContext, collection, object, callback);
        //}
        //else {
        //    callback();
        //}

        callback(null, obj);
    };

    if (_.str.startsWith(event, 'pre')) {
        runPreEvent(event, collection, data, cb);
    }
    else if (_.str.startsWith(event, 'post')) {
        runPostEvent(event, collection, data, cb);
    }
    else {
        cb(null, data);
    }
};

module.exports = Database;