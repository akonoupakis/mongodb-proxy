var scrub = require('scrubber').scrub;
var extend = require('extend');
var uuid = require('./uuid.js');
var jsonValidation = require('json-validation');
var _ = require('underscore');

function Store(database, name) {
    this.name = name;
    this.db = database;
};

Store.prototype.get = function (fn, cb) {
    var self = this;

    var processor = new GetOptionsProcessor();
    fn(processor);
    
    var processed = processor.get();

    var cacheKeyObj = extend(true, {}, processed);
    delete cacheKeyObj.cached;
    delete cacheKeyObj.resolved;

    var cacheKey = 'db.' + this.name + '.get.' + JSON.stringify(cacheKeyObj, null, '').replace(/\./g, '-');

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    var getResults = function (cb) {
        getCollection(self.db, self.name, function (err, col) {
            if (err) {
                cb(err);
            }
            else {
                if (processed.single) {
                    if (processed.resolved) {
                        col.findOne(processed.query, processed.fields, processed.options, function (err, result) {
                            cb(err, outbound(result));
                        });
                    }
                    else {
                        cb(null, null);
                    }
                }
                else {
                    col.find(processed.query, processed.fields, processed.options).toArray(function (err, results) {
                        cb(err, outbound(results));
                    });
                }
            }
        });
    };

    var cacheAndReturn = function (crErr, crResults) {
        if (crErr) 
            return error(crErr);
        
        self.db.cache.add(cacheKey, crResults, function (cachedErr, cachedRes) {
            if (cachedErr)
                return error(cachedErr);

            return done(crResults);
        });
    };

    this.db.run('preread', this.name, null, function (preErr, preResults) {
        if (preErr)
            return error(preErr);

        if (processed.cached) {
            self.db.cache.get(cacheKey, function (cacheError, cachedResults) {
                if (cacheError)
                    return error(cacheError);

                if (!cachedResults) {
                    getResults(function (getErr, getResults) {
                        if (getErr)
                            return error(getErr);

                        self.run('read', getResults, function (readErr, readResults) {
                            if (readErr)
                                return error(readErr);

                            self.db.run('postread', self.name, readResults, function (postErr, postResults) {
                                if (postErr)
                                    return error(postErr);

                                cacheAndReturn(null, postResults);
                            });
                        });
                    });
                }
                else {
                    self.run('read', cachedResults, function (readErr, readResults) {
                        if (readErr)
                            return error(readErr);

                        self.db.run('postread', self.name, readResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            return done(postResults);
                        });
                    });
                }

            });
        }
        else {
            getResults(function (getErr, getResults) {
                if (getErr)
                    return error(getErr);

                self.run('read', getResults, function (readErr, readResults) {
                    if (readErr)
                        return error(readErr);

                    self.db.run('postread', self.name, readResults, function (postErr, postResults) {
                        if (postErr)
                            return error(postErr);

                        cb(null, postResults);
                    });
                });
            });
        }
    });
};

Store.prototype.post = function (fn, cb) {
    var self = this;

    var processor = new PostOptionsProcessor();
    fn(processor);

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    var processed = processor.get();

    var errors = self.validate(processed.data);

    if (errors) 
        return error(errors);
    
    getCollection(this.db, this.name, function (err, col) {
        if (err) 
            return error(err);
        
        self.db.run('precreate', self.name, processed.data, function (preErr, preResults) {
            if (preErr)
                return error(preErr);

            self.run('create', preResults, function (postErr, postResults) {
                if (postErr)
                    return error(postErr);

                col.insert(post, function (insErr, insResult) {
                    if (insErr) 
                        return error(insErr);
            
                    var outboundResults = processed.single ? outbound(_.first(insResult.ops)) : outbound(insResult.ops);

                    self.db.run('postcreate', self.name, outboundResults, function (postErr, postResults) {
                        if (postErr)
                            return error(postErr);

                        self.emit(self.name + ':create', postResults);

                        return done(outboundResults);
                    });
                });
            });
        });
    });
};

Store.prototype.put = function (fn, cb) {
    var self = this;

    var processor = new PutOptionsProcessor();
    fn(processor);

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    var processed = processor.get();

    var errors = self.validate(processed.data);

    if (errors) 
        return error(errors);
    
    getCollection(this.db, this.name, function (err, col) {
        if (err)
            return error(err);

        col.find(processed.query, undefined, { limit: 500 }).toArray(function (getErr, getResults) {
            if (getErr)
                return error(getErr);

            var outboundResults = outbound(getResults);

            self.db.run('preupdate', self.name, outboundResults, function (preErr, preResults) {
                if (preErr)
                    return error(preErr);

                self.run('put', outboundResults, function (putErr, putResults) {
                    if (putErr)
                        return error(putErr);

                    var resultIds = _.pluck(putResults, 'id');

                    col.update({
                        id: {
                            $in: resultIds
                        }
                    }, putResults, { multi: !processed.single }, function (updErr, updResult) {
                        if (updErr)
                            return error(updErr);

                        self.db.run('postupdate', self.name, putResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            self.emit(self.name + ':update', putResults);

                            return done(updResult.result.n);
                        });
                    });
                });
            });
        });
    });
};

Store.prototype.del = function (fn, cb) {
    var self = this;

    var processor = new DelOptionsProcessor();
    fn(processor);

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    getCollection(this.db, this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            var processed = processor.get();
            col.find(processed.query, undefined, { limit: 500 }).toArray(function (getErr, getResults) {
                if (getErr)
                    return error(getErr);

                var outboundResults = outbound(getResults);

                self.db.run('predelete', self.name, outboundResults, function (preErr, preResults) {
                    if (preErr)
                        return error(preErr);
                    
                    self.run('del', outboundResults, function (delErr, delResults) {
                        if (delErr)
                            return error(delErr);

                        var resultIds = _.pluck(outboundResults, 'id');

                        col.remove({
                            id: {
                                $in: resultIds
                            }
                        }, function (err, result) {
                            if (err) {
                                return error(err);
                            }
                            else {
                                self.db.run('postdelete', self.name, delResults, function (postErr, postResults) {
                                    if (postErr)
                                        return error(postErr);

                                    self.emit(self.name + ':delete', delResults);

                                    return done(result.result.n);
                                });
                            }
                        });                        
                    });
                });
            });
        }
    });
};

Store.prototype.count = function (fn, cb) {
    var self = this;

    var processor = new CountOptionsProcessor();
    fn(processor);

    var processed = processor.get();

    var cacheKeyObj = extend(true, {}, processed);
    delete cacheKeyObj.cached;
    delete cacheKeyObj.resolved;

    var cacheKey = 'db.' + this.name + '.count.' + JSON.stringify(cacheKeyObj, null, '').replace(/\./g, '-');

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    var getResults = function (cb) {
        getCollection(self.db, self.name, function (err, col) {
            if (err) 
               return error(err);
            
            col.count(processed.query, function (err, count) {
                if (err)
                    return error(err);

                return done(count);
            });            
        });
    };

    var cacheAndReturn = function (crErr, crResults) {
        if (crErr) 
            return error(crErr);
        
        self.db.cache.add(cacheKey, crResults, function (cachedErr, cachedRes) {
            if (cachedErr)
                return error(cachedErr);

            return done(crResults);
        });
    };

    this.db.run('preread', this.name, null, function (preErr, preResults) {
        if (preErr)
            return error(preErr);

        if (processed.cached) {
            this.db.cache.get(cacheKey, function (cacheError, cachedResults) {
                if (cacheError)
                    return error(cacheError);

                if (!cachedResults) {
                    getResults(cacheAndReturn);
                }
                else {
                    return done(cachedResults);
                }
            });
        }
        else {
            getResults(cb);
        }

    });
};

Store.prototype.validate = function (data) {
    var schema = this.db.collections[this.name] && this.db.collections[this.name].schema;
    if (!schema)
        return;

    var validateFn = function (item) {
        var errors = {};

        var validator = new jsonValidation.JSONValidation();
        var validationResult = validator.validate(item, schema);
        if (!validationResult.ok) {
            errors['schema'] = validationResult.path + ': ' + validationResult.errors.join(' - ');
        }

        if (_.isObject(schema.properties)) {
            var allowedKeys = _.union('id', _.keys(schema.properties));
            var bodyKeys = _.keys(item || {});
            var spareKeys = _.filter(bodyKeys, function (x) { return allowedKeys.indexOf(x) === -1; });
            if (spareKeys.length > 0)
                errors['invalidKeys'] = spareKeys.join(',');
        }

        if (Object.keys(errors).length) return errors;
    }

    var result = null;

    if (_.isArray(data)) {
        _.each(data, function (d) {
            var errs = validateFn(d);
            if (errs) {
                if (result === null)
                    result = {};

                extend(true, result, errs);
            }
        });
    }
    else {
        var errs = validateFn(data);
        if (errs) {
            if (result === null)
                result = {};

            extend(true, result, errs);
        }
    }

    if (result)
        return result;
};

Store.prototype.run = function (event, data, cb) {
    cb(null, data);
};

Store.prototype.emit = function (name, data) {
    // emit here
};

module.exports = Store;


function getCollection(db, name, cb) {

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
    this._cached = false;
    this._resolved = true;

    this._query = undefined;
    this._fields = undefined;
    this._options = {
        limit: 500
    };
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

    if (_.isString(this._query)) {
        this._single = true;
    }
    else {
        if (_.isObject(this._query) && uuid.isValid(this._query.toString())) {
            this._single = true;
        }
        else if (_.isObject(this._query) && this._query._id && uuid.isValid(this._query._id.toString())) {
            this._single = true;
        }
    }

    if (this._single && _.isString(this._query) && !uuid.isValid(this._query)) {        
        this._resolved = false;
    }

};

GetOptionsProcessor.prototype.single = function (value) {
    this._single = value === undefined || value === true;
};

GetOptionsProcessor.prototype.cached = function () {
    this._cached = true;
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
    extend(true, this._options, options);
};

GetOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        fields: this._fields,
        options: this._options,
        cached: this._cached,
        single: this._single,
        resolved: this._resolved
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
    this._data = _.isArray(data) ? _.map(data, function (x) { return extend(true, {}, x); }) : extend(true, {}, data);
    
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
    var _data = extend(true, {}, data);
    var command = {};

    Object.keys(_data).forEach(function (k) {
        if (k.indexOf('$') === 0) {
            command[k] = _data[k];
            delete _data[k];
        }
    });

    if (Object.keys(_data).length) {
        command.$set = _data;
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