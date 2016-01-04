var extend = require('extend');
var uuid = require('./uuid.js');
var jsonValidation = require('json-validation');
var async = require('async');
var Context = require('./Context.js');
var Exception = require('./Exception.js');
var debug = require('debug')('mongodb-proxy');

var _ = require('underscore');

function Store(database, name, req, res, internal) {
    this.name = name;
    this.req = req;
    this.res = res;
    this.db = database;
    this.internal = internal === undefined || internal === true;
};

var debugAction = function (method, name, query) {

    var strQuery = _.isObject(query) && !uuid.isValid(query.toString()) ? JSON.stringify(query) : (query || '').toString();

    debug('store request %s %s', method.toUpperCase(), '/' + name + '?q=' + strQuery);
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

            self.run('resolve', null, crResults, function (resolveErr, resolveResults) {
                if (resolveErr)
                    return error(resolveErr);

                return done(resolveResults);
            });
        });
    };

    debugAction('GET', self.name, processed.query);

    this.db.run(this, 'preread', null, null, function (preErr, preResults) {
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

                        if (getResults) {
                            self.run('get', null, getResults, function (readErr, readResults) {
                                if (readErr)
                                    return error(readErr);

                                self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                                    if (postErr)
                                        return error(postErr);

                                    cacheAndReturn(null, postResults);
                                });
                            });
                        }
                        else {
                            return done(getResults);
                        }
                    });
                }
                else {
                    self.run('read', null, cachedResults, function (readErr, readResults) {
                        if (readErr)
                            return error(readErr);

                        self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            self.run('resolve', null, postResults, function (resolveErr, resolveResults) {
                                if (resolveErr)
                                    return error(resolveErr);

                                return done(resolveResults);
                            });
                        });
                    });
                }

            });
        }
        else {
            getResults(function (getErr, getResults) {
                if (getErr)
                    return error(getErr);

                if (getResults) {
                    self.run('get', null, getResults, function (readErr, readResults) {
                        if (readErr)
                            return error(readErr);

                        self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            self.run('resolve', null, postResults, function (resolveErr, resolveResults) {
                                if (resolveErr)
                                    return error(resolveErr);

                                return done(resolveResults);
                            });
                        });
                    });
                }
                else {
                    return done(getResults);
                }
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

    debugAction('POST', self.name, processed.query);

    getCollection(this.db, this.name, function (err, col) {
        if (err)
            return error(err);

        self.db.run(self, 'precreate', null, processed.data, function (preErr, preResults) {
            if (preErr)
                return error(preErr);

            self.run('create', null, preResults, function (postErr, postResults) {
                if (postErr)
                    return error(postErr);

                self.validate(preResults, function (val1Err, val1Results) {
                    if (val1Err)
                        return error(val1Err);

                    self.run('validate', null, preResults, function (val2Err, val2Results) {
                        if (val2Err)
                            return error(val2Err);

                        col.insert(postResults, function (insErr, insResult) {
                            if (insErr)
                                return error(insErr);

                            var outboundResults = processed.single ? outbound(_.first(insResult.ops)) : outbound(insResult.ops);
                            self.db.run(self, 'postcreate', null, outboundResults, function (postCrErr, postCrResults) {
                                if (postCrErr)
                                    return error(postCrErr);

                                self.run('resolve', null, outboundResults, function (resolveErr, resolveResults) {
                                    if (resolveErr)
                                        return error(resolveErr);

                                    return done(resolveResults);
                                });
                            });
                        });
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

    debugAction('PUT', self.name, processed.query);

    getCollection(this.db, this.name, function (err, col) {
        if (err)
            return error(err);

        col.find(processed.query, undefined, { limit: 500 }).toArray(function (getErr, getResults) {
            if (getErr)
                return error(getErr);

            var outboundResults = outbound(getResults);
            if (outboundResults.length > 0) {
                var nextResults = _.map(outboundResults, function (x) {
                    var newObj = {};
                    extend(true, newObj, x);

                    if (processed.data.$set)
                        extend(true, newObj, processed.data.$set);

                    if (processed.data.$unset) {
                        for (var unsetItem in processed.data.$unset)
                            delete newObj[unsetItem];
                    }

                    return newObj;
                });
                self.db.run(self, 'preupdate', outboundResults, nextResults, function (preErr, preResults) {
                    if (preErr)
                        return error(preErr);

                    self.run('put', outboundResults, nextResults, function (putErr, putResults) {
                        if (putErr)
                            return error(putErr);

                        var resultIds = _.pluck(outboundResults, 'id');

                        self.validate(nextResults, function (val1Err, val1Results) {
                            if (val1Err)
                                return error(val1Err);

                            self.run('validate', outboundResults, nextResults, function (val2Err, val2Results) {
                                if (val2Err)
                                    return error(val2Err);

                                col.update({
                                    _id: {
                                        $in: _.map(resultIds, function (x) { return uuid.create(x); })
                                    }
                                }, processed.data, { multi: !processed.single }, function (updErr, updResult) {
                                    if (updErr)
                                        return error(updErr);

                                    self.db.run(self, 'postupdate', outboundResults, nextResults, function (putErr, putResults) {
                                        if (putErr)
                                            return error(putErr);

                                        self.run('resolve', outboundResults, putResults, function (resolveErr, resolveResults) {
                                            if (resolveErr)
                                                return error(resolveErr);

                                            return done(updResult.result.n);
                                        });
                                    });
                                });

                            });
                        });
                    });
                });
            }
            else {
                return done(0);
            }
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

    var processed = processor.get();

    debugAction('DEL', self.name, processed.query);

    getCollection(this.db, this.name, function (err, col) {
        if (err) {
            cb(err);
        }
        else {
            col.find(processed.query, undefined, { limit: 500 }).toArray(function (getErr, getResults) {
                if (getErr)
                    return error(getErr);

                var outboundResults = outbound(getResults);
                if (outboundResults.length > 0) {
                    self.db.run(self, 'predelete', null, outboundResults, function (preErr, preResults) {
                        if (preErr)
                            return error(preErr);

                        self.run('del', null, outboundResults, function (delErr, delResults) {
                            if (delErr)
                                return error(delErr);

                            var resultIds = _.pluck(outboundResults, 'id');

                            col.remove({
                                _id: {
                                    $in: _.map(resultIds, function (x) { return uuid.create(x); })
                                }
                            }, function (err, result) {
                                if (err)
                                    return error(err);

                                self.db.run(self, 'postdelete', null, delResults, function (postErr, postResults) {
                                    if (postErr)
                                        return error(postErr);

                                    self.run('resolve', null, delResults, function (resolveErr, resolveResults) {
                                        if (resolveErr)
                                            return error(resolveErr);

                                        return done(result.result.n);
                                    });
                                });
                            });
                        });
                    });
                }
                else {
                    return done(0);
                }
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

    debugAction('COUNT', self.name, processed.query);

    this.db.run(this, 'preread', null, null, function (preErr, preResults) {
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

Store.prototype.validate = function (data, cb) {
    var schema = this.db.collections[this.name] && this.db.collections[this.name].schema;
    if (!schema)
        return cb(null, data);

    var validateFn = function (item, index) {
        var errors = {};

        var validator = new jsonValidation.JSONValidation();
        var validationResult = validator.validate(item, schema);
        if (!validationResult.ok) {
            errors['schema' + (index ? '-' + index : '')] = validationResult.path + ': ' + validationResult.errors.join(' - ');
        }

        if (_.isObject(schema.properties)) {
            var allowedKeys = _.union(['id'], _.keys(schema.properties));
            var bodyKeys = _.keys(item || {});
            var spareKeys = _.filter(bodyKeys, function (x) { return allowedKeys.indexOf(x) === -1; });
            if (spareKeys.length > 0)
                errors['invalid' + (index ? '-' + index : '')] = spareKeys.join(',');
        }

        if (Object.keys(errors).length) return errors;
    }

    var result = null;

    if (_.isArray(data)) {
        _.each(data, function (d, i) {
            var errs = validateFn(d, i);
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

    if (result) {
        cb(new Exception(400, result));
    }
    else {
        cb(null, data);
    }
};

Store.prototype.run = function (event, previousData, data, cb) {
    var self = this;

    var error = function (err) {
        cb(err);
    };

    var done = function (response) {
        cb(null, response);
    };

    var collection = this.db.collections[this.name];
    if (!collection)
        return done(data);

    var scriptFns = collection.scripts && collection.scripts[event];
    if (_.isArray(scriptFns) && scriptFns.length > 0) {
        var newDocument = ['create', 'validate'].indexOf(event) !== -1;
        var single = false;
        var dataTaskIds = []
        var dataTasks = [];

        var taskProcess = function (d, prev, tcb) {
            var eventTasks = [];

            _.each(scriptFns, function (scriptFn) {
                eventTasks.push(function (tcbb) {
                    var context = new Context(self, d, prev, tcbb);
                    scriptFn(self.db, context, d);
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
                var prev = !newDocument ? (_.isArray(previousData) ? _.find(previousData, function (x) {
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
        done(data);
    }
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

    var scrubObj = function (obj) {

        for (var name in obj) {

            var value = obj[name];
            if (!_.isArray(value) && uuid.isValid(value)) {
                if (name === 'id' && obj.id) {
                    obj._id = uuid.create(value);
                    delete obj.id;
                }
                else {
                    obj[name] = uuid.create(value);
                }
            }
            else if (_.isArray(value)) {
                if (_.all(value, function (x) {
                    return _.isString(x) && uuid.isValid(x);
                })) {
                    obj[name] = _.map(value, function (x) { return uuid.create(x); });
                }
                else if (_.all(value, function (x) {
                    return _.isObject(x);
                })) {
                    _.each(value, function (val) {
                        scrubObj(val);
                    });
                }
            }

        }
    }

    var process = function (obj) {
        if (_.isObject(obj))
            scrubObj(obj);
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

    var scrubObj = function (obj) {

        for (var name in obj) {

            var value = obj[name];
            if (!_.isArray(value) && uuid.isValid(value)) {
                if (name === '_id' && obj._id) {
                    obj.id = value.toString();
                    delete obj._id;
                }
                else {
                    obj[name] = value.toString();
                }
            }
            else if (_.isArray(value)) {
                if (_.all(value, function (x) {
                    return !_.isArray(x) && uuid.isValid(x);
                })) {
                    obj[name] = _.map(value, function (x) { return x.toString(); });
                }
                else if (_.all(value, function (x) {
                    return _.isObject(x);
                })) {
                    _.each(value, function (val) {
                        scrubObj(val);
                    });
                }
            }

        }
    }

    var process = function (obj) {
        if (_.isObject(obj))
            scrubObj(obj);
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
    OptionsProcessor.apply(this, arguments);

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
    var self = this;

    this._raw = extend(true, {}, data);
    var command = {};

    Object.keys(self._raw).forEach(function (k) {
        if (k.indexOf('$') === 0) {
            command[k] = self._raw[k];
            delete self._raw[k];
        }
    });

    if (Object.keys(self._raw).length) {
        command.$set = self._raw;
    }

    inbound(command);

    this._data = command;
};

PutOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        data: this._data,
        raw: this._raw,
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