var mongodb = require('mongodb');
var scrub = require('scrubber').scrub;
var uuid = require('./uuid.js');
var _ = require('underscore');

var db = null;

function Store(database, name) {
    this.name = name;

    db = database;
};

Store.prototype.get = function (fn, cb) {

    var processor = new GetOptionsProcessor();
    fn(processor);
    
    getCollection(this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            if (processed.single) {
                col.findOne(processed.query, processed.fields, processed.options, function (err, result) {
                    cb(err, outbound(result));
                });
            }
            else {
                col.find(processed.query, processed.fields, processed.options).toArray(function (err, results) {
                    cb(err, outbound(results));
                });
            }
        }
    });

};

Store.prototype.post = function (fn, cb) {
    var processor = new PostOptionsProcessor();
    fn(processor);

    getCollection(this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            col.insert(processed.data, function (err, result) {
                if (err) {
                    cb(err);
                }
                else {
                    if (processed.single) {
                        cb(null, outbound(_.first(result.ops)));
                    }
                    else {
                        cb(null, outbound(result.ops));
                    }
                }
            });
        }
    });
};

Store.prototype.put = function (fn, cb) {
    var processor = new PutOptionsProcessor();
    fn(processor);

    getCollection(this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            col.update(processed.query, processed.data, { multi: !processed.single },  function (err, result) {
                if (err) {
                    cb(err);
                }
                else {
                    cb(null, result.result.n);
                }
            });
        }
    });
};

Store.prototype.del = function (fn, cb) {
    var processor = new DelOptionsProcessor();
    fn(processor);

    getCollection(this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            col.remove(processed.query, function (err, result) {
                if (err) {
                    cb(err);
                }
                else {
                    cb(null, result.result.n);
                }
            });
        }
    });
};

Store.prototype.count = function (fn, cb) {
    var processor = new CountOptionsProcessor();
    fn(processor);

    getCollection(this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            col.count(processed.query, function (err, count) {
                cb(err, count);
            });
        }
    });
};

module.exports = Store;


function getCollection(name, cb) {

    db.connect(function (err, mdb) {
        if (err) {
            cb(err);
        }
        else {
            mdb.collection(name, function (err, collection) {
                if (err || !collection) {
                    cb(err ? err : new Error('Unable to get ' + name + ' collection'));
                }
                else {
                    cb(null, collection);
                }
            });
        }
    });

}

var inbound = function (object) {

    var process = function (obj) {
        if (obj.id) {
            if (uuid.isValid(obj.id))
                obj._id = uuid.create(obj.id);
            else
                obj._id = obj.id;

            delete obj.id;
        }

        scrub(obj, function (value, key, parent, type) {
            if (key === 'id' && parent.id) {
                if (uuid.isValid(value)) {
                    parent._id = uuid.create(value);
                }
                else {
                    parent._id = value;
                    delete parent.id;
                }
            }
            else {
                if (uuid.isValid(value)) {
                    parent[key] = uuid.create(value);
                }
            }
        });
    };

    if (_.isArray(object)) {
        object.forEach(process);
    } else {
        if (_.isObject(object)) {
            process(object);
        }
    }

    return object;
}

var outbound = function (object) {

    var process = function (obj) {
        if (obj._id) {
            if (uuid.isValid(obj._id))
                obj.id = uuid.create(obj._id);
            else
                obj.id = obj._id;

            delete obj._id;
        }

        scrub(obj, function (value, key, parent, type) {
            if (key === '_id' && parent._id) {
                if (uuid.isValid(value)) {
                    parent.id = value.toString();
                }
                else {
                    parent.id = value;
                    delete parent._id;
                }
            }
            else {
                if (uuid.isValid(value)) {
                    parent[key] = value.toString();
                }
            }
        });
    };

    if (_.isArray(object)) {
        object.forEach(process);
    } else {
        if (_.isObject(object)) {
            process(object);
        }
    }

    return object;
}

var OptionsProcessor = function () {

};

OptionsProcessor.prototype.get = function () {
    return {};
};

var GetOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._single = false;

    this._query = undefined;
    this._fields = undefined;
    this._options = undefined;
};
GetOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

GetOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        inbound(this._query);
    }
    else if (_.isString(query) && uuid.isValid(query)) {
        this._query = uuid.create(query);
    }

    if (_.isObject(this._query) && uuid.isValid(this._query.toString())) {
        this._single = true;
    }
    else if (_.isObject(this._query) && this._query._id && uuid.isValid(this._query._id.toString())) {
        this._single = true;
    }
};

GetOptionsProcessor.prototype.single = function (value) {
    this._single = value === undefined || value === true;
};

GetOptionsProcessor.prototype.fields = function (fields) {
    if (_.isArray(fields)) {
        var dataFields = {};
        _.each(fields, function (field) {
            if (_.isString(field)) {
                dataFields[field] = 1;
            }
        });
        this._fields = dataFields;
    }
    else if (_.isObject(fields)) {
        this._fields = fields;
    }
};

GetOptionsProcessor.prototype.options = function (options) {
    this._options = options;
};

GetOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        fields: this._fields,
        options: this._options,
        single: this._single
    };
};

var CountOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._query = undefined;
};
CountOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

CountOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        inbound(this._query);
    }
};

CountOptionsProcessor.prototype.get = function () {
    return {
        query: this._query
    };
};

var PostOptionsProcessor = function () {
    this._single = true;
    this._data = undefined;
};
PostOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

PostOptionsProcessor.prototype.data = function (data) {
    this._data = data;

    inbound(this._data);

    if (_.isArray(this._data))
        this._single = false;
};

PostOptionsProcessor.prototype.get = function () {
    return {
        data: this._data,
        single: this._single
    };
};

var PutOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._single = true;
    this._query = undefined;
};
PutOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

PutOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        inbound(this._query);
    }
    else if (_.isString(query) && uuid.isValid(query)) {
        this._query = {
            _id: uuid.create(query)
        };
    }

    if (!this._query._id)
        this._single = false;
};

PutOptionsProcessor.prototype.data = function (data) {
    var command = {};

    Object.keys(data).forEach(function (k) {
        if (k.indexOf('$') === 0) {
            command[k] = data[k];
            delete data[k];
        }
    });

    if (Object.keys(data).length) {
        command.$set = data;
    }

    inbound(command);

    this._data = command;
};

PutOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        data: this._data,
        single: this._single
    };
};

var DelOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._query = undefined;
};
DelOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

DelOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        inbound(this._query);
    }
    else if (_.isString(query) && uuid.isValid(query)) {
        this._query = {
            _id: uuid.create(query)
        };
    }
};

DelOptionsProcessor.prototype.get = function () {
    return {
        query: this._query
    };
};