var util = require('util');
var EventEmitter = require('events').EventEmitter;
var mongodb = require('mongodb');
var Store = require('./Store.js');
var jsonValidation = require('json-validation');
var Api = require('./Api.js');
var Cache = require('./Cache.js');
var Context = require('./Context.js');
var async = require('async');
var extend = require('extend');
var debug = require('debug')('mongodb-proxy');

var _ = require('underscore');
_.str = require('underscore.string');

var purgeCacheFn = function (sender, collection, context, data) {
    sender.cache.purge('db.' + collection, function (err, results) {
        if (err)
            context.error(err);
        else
            context.done();
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
                    events: {
                        type: 'object', properties: {
                            validate: { type: 'any' },
                            get: { type: 'any' },
                            post: { type: 'any' },
                            put: { type: 'any' },
                            del: { type: 'any' },
                            resolve: { type: 'any' }
                        }
                    }
                }
            });

            if (!validationResults.ok)
                throw new Error(validationResults.errors.join(", ") + " at path " + validationResults.path);

            if (!self.collections[collection.name]) {
                self.collections[collection.name] = {
                    name: collection.name,
                    schema: {},
                    scripts: {
                        validate: [],
                        get: [],
                        post: [],
                        put: [],
                        del: [],
                        resolve: []
                    }
                }
            }

            if (collection.schema) {
                extend(true, self.collections[collection.name].schema, collection.schema);
            }

            if (collection.events) {
                for (var eventName in collection.events) {
                    if (self.collections[collection.name].scripts[eventName]) {
                        if (typeof (collection.events[eventName]) === 'function')
                            self.collections[collection.name].scripts[eventName].push(collection.events[eventName]);
                    }
                }
            }
        },

        bind: function (name, fn) {
            if (!name || !fn)
                return;

            var eventNames = _.keys(self.events);

            if (eventNames.indexOf(name) === -1)
                throw new error('invalid bindable action. available are: ' + eventNames.join(','));

            self.events[name].push(fn);
        },

        cache: function (cache) {
            self.cache = cache;
        }
    };

    fn(processor);
};

Database.prototype.createStore = function (name, req, res, internal) {
    var store = new Store(this, name, req, res, internal);
    return store;
};

Database.prototype.createApi = function (req, res, internal) {
    var api = new Api(this, req, res, internal);
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
            data: { type: ['object', 'array'] },
            req: { type: 'object' },
            res: { type: 'object' }
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
        var api = this.createApi(route.req, route.res, false);

        if (api[route.collection]) {

            debug('http request %s %s', method.toUpperCase(), '/' + route.collection + route.path + (route.query ? '?q=' + encodeURIComponent(route.query) : ''));

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

Database.prototype.connect = function (cb) {
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

Database.prototype.run = function (store, event, previousData, data, cb) {
    var self = this;

    var error = function (err) {
        cb(err);
    };

    var done = function (response) {
        cb(null, response);
    };

    if (self.events[event]) {

        var newDocument = ['precreate', 'postcreate'].indexOf(event) !== -1;
        var single = false;
        var dataTaskIds = []
        var dataTasks = [];

        var taskProcess = function (d, prev, tcb) {
            var eventTasks = [];

            _.each(self.events[event], function (eventFn) {
                eventTasks.push(function (tcbb) {
                    var context = new Context(store, d, prev, null, tcbb);

                    if (event === 'preread' || event === 'precreate')
                        eventFn(self, store.name, context);
                    else
                        eventFn(self, store.name, context, d);
                });
            });


            var nextIndex = 0;
            var next = function (err, response) {
                if (err)
                    return tcb(err);

                nextIndex++;

                var eventTask = eventTasks[nextIndex];
                if (eventTask)
                    eventTask(next);
                else
                    tcb(null, d);
            };

            var first = _.first(eventTasks);
            if (first) {
                first(next);
            }
            else {
                tcb(null, d);
            }
        };

        if (_.isArray(data)) {
            _.each(data, function (d) {
                var prev = !newDocument ? (
                    _.isArray(previousData) ? _.find(previousData, function (x) {
                        return x.id === d.id;
                    }) : null) : null;

                dataTasks.push(function (tcb) {
                    taskProcess(d, prev, tcb);
                });

                if (!newDocument)
                    dataTaskIds.push(d.id);

                single = false;
            });
        }
        else if (_.isObject(data)) {
            dataTasks.push(function (tcb) {
                taskProcess(data, previousData, tcb);
            });

            if (!newDocument)
                dataTaskIds.push(data.id);

            single = true;
        }
        else {
            dataTasks.push(function (tcb) {
                taskProcess(null, null, tcb);
            });
            single = true;
        }

        if (dataTasks.length > 0) {
            async.parallel(dataTasks, function (err, results) {
                if (err)
                    return error(err);

                var parsedResults = !newDocument ? _.map(dataTaskIds, function (r) {
                    var dd = _.find(results, function (x) {
                        return x.id === r;
                    });
                    var ddd = single ? data : _.find(data, function (x) {
                        return x.id === r;
                    });

                    return dd || ddd;
                }) : results;

                return done(single ? _.first(parsedResults) : parsedResults);
            });
        }
        else {
            return done(data);
        }
    }
    else {
        return done(data);
    }
};

module.exports = Database;