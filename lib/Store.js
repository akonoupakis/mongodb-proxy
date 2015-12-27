var _ = require('underscore');
var scrub = require('scrubber').scrub;

function getConnection(db, cb) {

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

function getCollection(store, cb) {
    
    getConnection(store.db, function (err, mdb) {
        if (err) {
            cb(err);
        }
        else {
            mdb.collection(store.name, function (err, collection) {
                if (err || !collection) {
                    cb(err ? err : new Error('Unable to get ' + store.name + ' collection'));
                }
                else {
                    cb(null, collection);
                }
            });
        }
    });

}

var transform = function (object, sourceKey, targetKey) {

    var process = function (obj) {
        try {
            if (obj[sourceKey] && typeof obj[sourceKey] === 'object') {
                obj[targetKey] = obj[sourceKey];
                delete obj[sourceKey];
            }

            scrub(obj, function (obj, key, parent, type) {
                if (key === sourceKey && parent[sourceKey]) {
                    parent[targetKey] = parent[sourceKey];
                    delete parent[sourceKey];
                }
            });
        } catch (ex) {
            console.error('scrub error', ex);
        }
    };

    if (_.isArray(object)) {
        object.forEach(process);
    } else if (_.isObject(object)) {
        process(object);
    }

    return object;
}

function Store(database, name) {
    this.db = database;
    this.name = name;
};

var GetOptionsProcessor = function () {
    this.single = false;
    this.data = {
        query: undefined,
        fields: undefined,
        options: undefined
    };
};

GetOptionsProcessor.prototype.query = function (query) {
    if (_.isString(query)) {
        query = {
            id: query
        };
        this.single = true;
    }
    else if (_.isObject(query) && _.isString(query.id)) {
        this.single = true;
    }

    this.data.query = query;
    
    transform(this.data.query, 'id', '_id');
};

GetOptionsProcessor.prototype.fields = function (fields) {
    if (_.isArray(fields)) {
        var dataFields = {};
        _.each(fields, function (field) {
            if (_.isString(field)) {
                dataFields[field] = 1;
            }
        });
        this.data.fields = dataFields;
    }
    else if (_.isObject(fields)) {
        this.data.fields = fields;
    }
};

GetOptionsProcessor.prototype.options = function (options) {
    this.data.options = options;
};

GetOptionsProcessor.prototype.get = function () {
    return this.data;
};

Store.prototype.get = function (fn, cb) {

    var processor = new GetOptionsProcessor();
    fn(processor);
    
    getCollection(this, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var data = processor.get();
            if (processor.single) {
                col.findOne(data.query, data.fields, data.options, function (errr, resultt) {
                    cb(err, transform(resultt, '_id', 'id'));
                });
            }
            else {
                col.find(data.query, data.fields, data.options).toArray(function (err, results) {
                    cb(err, transform(results, '_id', 'id'));
                });
            }
        }
    });

};

Store.prototype.post = function (fn, cb) { };

Store.prototype.put = function (fn, cb) { };

Store.prototype.del = function (fn, cb) { };

Store.prototype.count = function (fn, cb) { };


module.exports = Store;