var extend = require('extend');
var uuid = require('./uuid.js');
var jsonValidation = require('json-validation');
var async = require('async');
var Context = require('./Context.js');
var Exception = require('./Exception.js');
var Scrubber = require('object-scrubber');
var debug = require('debug')('mongodb-proxy');

var _ = require('underscore');

/**
 * Represents a collection store.
 * @constructor
 * 
 * @param {Database} database - The database instance
 * @param {string} name - The collection name
 * @param {object} [req=null] - The http request object
 * @param {object} [res=null] - The http response object
 * @param {boolean} [internal=true] - Whether the store is in internal mode or not
 * 
 * @property {string} name - The collection name.
 * @property {Database} database - The database instance
 * @property {object} [req=null] - The http request object
 * @property {object} [res=null] - The http response object
 * @property {boolean} [internal=true] - Whether the store is in internal mode or not
 */
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

/**
 * Get a collection instance for this store.
 * This collection is coming directly from the mongodb driver, therefore actions will not be filtered by any events injected.
 * 
 * @tutorial using-mongodb-driver
 * @example
 * store.getCollection(function(err, collection) { 
 *   if(err) 
 *      throw err;
 * 
 *   collection.find(...)
 * });
 * 
 * @param {Store~getCollectionCallback} cb - The callback function
 */
Store.prototype.getCollection = function(cb) {

    /**
    * @callback Store~getCollectionCallback
    * @param {Exception} err - The exception object
    * @param {string} collection - The mongodb driver collection instance
    */

    var self = this;
    
    self.db.connect(function (err, mdb) {
        if (err) {
            cb(err);
        }
        else {
            mdb.collection(self.name, function (err, collection) {
                if (err || !collection) {
                    cb(err ? err : new Error('Unable to get ' + self.name + ' collection'));
                }
                else {
                    cb(null, collection);
                }
            });
        }
    });
};

/**
 * Read through a collection invoking the callback for each in the cursor.
 * 
 * @param {function} options - The query options function passing {@link ReadOptionsProcessor} as an argument
 * @param {Store~readCallback} cb - The callback function for each result
 * @param {Store~readNextCallback} next - The next function for all results upon complete
 * 
 * @example
 * store.read(function (x) {
 *   x.query();
 *   x.fields(['firstName']);
 *   x.options({
 *      limit: 100
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 * 
 * }, function() {
 *   console.log('completed!');
 * });
 */
Store.prototype.read = function (options, cb, next) {
   
    /**
    * @callback Store~readCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The cursored result
    */
    
    /**
    * @callback Store~readNextCallback
    */    
    
    var self = this;

    var processor = new ReadOptionsProcessor();
    options(processor);

    var processed = processor.get();

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }


    debugAction('READ', self.name, processed.query);

    this.db.run(this, 'preread', null, null, function (preErr, preResults) {
        if (preErr)
            return error(preErr);

        self.getCollection(function (err, col) {
            if (err) {
                cb(err);
            }
            else {
                col.find(processed.query, processed.fields, processed.options, function (cursorErr, cursor) {
                    if (cursorErr)
                        return error(cursorErr);

                    function processItem(err, myDoc) {
                        if (err)
                            return error(err);

                        if (myDoc === null) 
                            return next();

                        var result = outbound(myDoc);
                        self.run('get', null, result, null, function (readErr, readResults) {
                            if (readErr)
                                return error(readErr);

                            self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                                if (postErr)
                                    return error(postErr);

                                self.run('resolve', null, postResults, null, function (resolveErr, resolveResults) {
                                    if (resolveErr)
                                        return error(resolveErr);

                                    done(resolveResults);

                                    cursor.nextObject(processItem);
                                });
                            });
                        });
                    };

                    cursor.nextObject(processItem);
                });
            }
        });
    });
};

/**
 * Get data from the collection.
 * 
 * @param {function} options - The query options function passing {@link GetOptionsProcessor} as an argument
 * @param {Store~getCallback} cb - The callback function
 * 
 * @example
 * store.get(function (x) {
 *   x.query();
 *   x.single();
 *   x.cached();
 *   x.fields(['firstName']);
 *   x.options({
 *      limit: 100,
 *      sort: {
 *        firstName: 1
 *      }
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 *   
 * });
 */
Store.prototype.get = function (options, cb) {

    /**
    * @callback Store~getCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The results
    */
    
    var self = this;

    var processor = new GetOptionsProcessor();
    options(processor);

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
        self.getCollection(function (err, col) {
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

            self.run('resolve', null, crResults, null, function (resolveErr, resolveResults) {
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
                            self.run('get', null, getResults, null, function (readErr, readResults) {
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
                    self.run('read', null, cachedResults, null, function (readErr, readResults) {
                        if (readErr)
                            return error(readErr);

                        self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            self.run('resolve', null, postResults, null, function (resolveErr, resolveResults) {
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
                    self.run('get', null, getResults, null, function (readErr, readResults) {
                        if (readErr)
                            return error(readErr);

                        self.db.run(self, 'postread', null, readResults, function (postErr, postResults) {
                            if (postErr)
                                return error(postErr);

                            self.run('resolve', null, postResults, null, function (resolveErr, resolveResults) {
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

/**
 * Post new data to the collection.
 * 
 * @param {function} options - The query options function passing {@link PostOptionsProcessor} as an argument
 * @param {Store~postCallback} cb - The callback function
 * 
 * @example
 * store.post(function (x) {
 *   x.data({
 *      firstName: 'John',
 *      lastName: 'Smith'
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 *   
 * });
 */
Store.prototype.post = function (fn, cb) {

    /**
    * @callback Store~postCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The posted results
    */

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

    self.getCollection(function (err, col) {
        if (err)
            return error(err);


        self.db.run(self, 'precreate', null, processed.data, function (preErr, preResults) {
            if (preErr)
                return error(preErr);

            self.run('post', null, preResults, processed.data, function (postErr, postResults) {
                if (postErr)
                    return error(postErr);

                var processedData = inbound(postResults);
                self.validate(processedData, function (val1Err, val1Results) {
                    if (val1Err)
                        return error(val1Err);

                    self.run('validate', null, processedData, null, function (val2Err, val2Results) {
                        if (val2Err)
                            return error(val2Err);

                        col.insert(processedData, function (insErr, insResult) {
                            if (insErr)
                                return error(insErr);

                            var outboundResults = processed.single ? outbound(_.first(insResult.ops)) : outbound(insResult.ops);

                            self.db.run(self, 'postcreate', null, outboundResults, function (postCrErr, postCrResults) {
                                if (postCrErr)
                                    return error(postCrErr);

                                self.run('resolve', null, outboundResults, null, function (resolveErr, resolveResults) {
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

/**
 * Update data in the collection.
 * 
 * @param {function} options - The query options function passing {@link PutOptionsProcessor} as an argument
 * @param {Store~putCallback} cb - The callback function
 * 
 * @example
 * store.put(function (x) {
 *   x.query({
 *      firstName: 'John',
 *      lastName: 'Smith'
 *   });
 *   x.data({
 *      firstName: 'John2',
 *      lastName: 'Smith2'
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 *   
 * });
 */
Store.prototype.put = function (options, cb) {

    /**
    * @callback Store~putCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The update results
    */
    
    var self = this;

    var processor = new PutOptionsProcessor();
    options(processor);

    var error = function (err) {
        cb(err);
    };

    var done = function (results) {
        cb(null, results);
    }

    var processed = processor.get();

    debugAction('PUT', self.name, processed.query);

    self.getCollection(function (err, col) {
        if (err)
            return error(err);

        col.find(processed.query, undefined, { limit: 500 }).toArray(function (getErr, getResults) {

            if (getErr)
                return error(getErr);

            var outboundResults = outbound(getResults);

            var getProcessedData = function () {
                var processedRaw = extend(true, {}, processed.data);
                delete processedRaw.id;

                var command = {};

                Object.keys(processedRaw).forEach(function (k) {
                    if (k.indexOf('$') === 0) {
                        command[k] = processedRaw[k];
                        delete processedRaw[k];
                    }
                });

                if (Object.keys(processedRaw).length) {
                    command.$set = processedRaw;
                }

                var processedData = inbound(command);

                return processedData;
            };

            var getNextResults = function () {

                var processedData = getProcessedData();
                return _.map(outboundResults, function (x) {
                    var newObj = {};
                    extend(true, newObj, x);

                    if (processedData.$set) {
                        Object.keys(processedData.$set).forEach(function (k) {
                            newObj[k] = processedData.$set[k];
                        });
                    }

                    if (processedData.$unset) {
                        for (var unsetItem in processedData.$unset)
                            delete newObj[unsetItem];
                    }

                    return newObj;
                });
            };

            if (outboundResults.length > 0) {
                var nextResults = getNextResults();

                self.db.run(self, 'preupdate', outboundResults, nextResults, function (preErr, preResults) {
                    if (preErr)
                        return error(preErr);

                    self.run('put', outboundResults, nextResults, processed.data, function (putErr, putResults) {
                        if (putErr)
                            return error(putErr);

                        nextResults = getNextResults();

                        var resultIds = _.pluck(outboundResults, 'id');

                        self.validate(inbound(nextResults), function (val1Err, val1Results) {
                            if (val1Err)
                                return error(val1Err);

                            self.run('validate', outboundResults, nextResults, null, function (val2Err, val2Results) {
                                if (val2Err)
                                    return error(val2Err);

                                var updateData = getProcessedData();
                                col.update({
                                    _id: {
                                        $in: _.map(resultIds, function (x) { return uuid.create(x); })
                                    }
                                }, updateData, { multi: !processed.single }, function (updErr, updResult) {
                                    if (updErr)
                                        return error(updErr);

                                    var postNextResults = outbound(getNextResults());
                                    self.db.run(self, 'postupdate', outboundResults, postNextResults, function (putErr, putResults) {
                                        if (putErr)
                                            return error(putErr);

                                        self.run('resolve', outboundResults, putResults, null, function (resolveErr, resolveResults) {
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

/**
 * Counts data from the collection.
 * 
 * @param {function} options - The query options function passing {@link CountOptionsProcessor} as an argument
 * @param {Store~countCallback} cb - The callback function
 * 
 * @example
 * store.count(function (x) {
 *   x.query({
 *      firstName: 'John',
 *      lastName: 'Smith'
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 *   
 * });
 */
Store.prototype.count = function (fn, cb) {

    /**
    * @callback Store~countCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The count result
    */

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
        self.getCollection(function (err, col) {
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

/**
 * Delete data from the collection.
 * 
 * @param {function} options - The query options function passing {@link DelOptionsProcessor} as an argument
 * @param {Store~delCallback} cb - The callback function
 * 
 * @example
 * store.del(function (x) {
 *   x.query({
 *      firstName: 'John',
 *      lastName: 'Smith'
 *   });
 * }, function (err, res) {
 *   if(err) 
 *      throw err;
 *   
 * });
 */
Store.prototype.del = function (fn, cb) {

    /**
    * @callback Store~delCallback
    * @param {Exception} err - The exception object
    * @param {object} res - The delete results
    */

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

    self.getCollection(function (err, col) {
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

                        self.run('del', null, outboundResults, null, function (delErr, delResults) {
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

                                    self.run('resolve', null, delResults, null, function (resolveErr, resolveResults) {
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

Store.prototype.validate = function (data, cb) {
    var schema = this.db.collections[this.name] && this.db.collections[this.name].schema;
    if (!schema)
        return cb(null, data);

    var validateFn = function (item, index) {
        var errors = {};

        var validator = new jsonValidation.JSONValidation();

        validator.validateObjectId = function (obj, schema, errors) {
            if (obj === '')
                return true;

            if (!_.isArray(obj) && _.isObject(obj) && uuid.isValid(obj)) {
                return true;
            }
            else {
                errors.push("Object is invalid mongo uuid: " + obj);
                return false;
            }
        };

        var validationResult = validator.validate(item, schema);
        if (!validationResult.ok) {
            errors['schema' + (index ? '-' + index : '')] = validationResult.path + ': ' + validationResult.errors.join(' - ');
        }

        if (_.isObject(schema.properties)) {
            var allowedKeys = _.union(['_id', 'id'], _.keys(schema.properties));
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

Store.prototype.run = function (event, previousData, data, raw, cb) {
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
        var newDocument = ['post', 'validate'].indexOf(event) !== -1;
        var single = false;
        var dataTaskIds = []
        var dataTasks = [];

        var taskProcess = function (d, prev, tcb) {
            var eventTasks = [];

            _.each(scriptFns, function (scriptFn) {
                eventTasks.push(function (tcbb) {
                    var context = new Context(self, d, prev, raw, tcbb);
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


var inbound = function (object) {
    var scrubber = new Scrubber();

    scrubber.when(function (x) {
        return x.parent && x.key === 'id';
    }, function (x) {
        x.parent._id = x.value;
        delete x.parent.id;
        x.key = '_id';

        if (_.isString(x.value) && uuid.isValid(x.value))
            x.parent._id = uuid.create(x.value);
    });

    scrubber.when(function (x) {
        return _.isArray(x.value);
    }, function (x) {
        if (uuid.isValid(x.value)) {
            _.each(x.value, function (v, i) {
                if (v)
                    x.value[i] = uuid.create(v);
            });
        }
        else {
            x.scrub(x.value);
        }
    });

    scrubber.when(function (x) {
        return _.isString(x.value) && uuid.isValid(x.value);
    }, function (x) {
        var uuidd = uuid.create(x.value);
        x.value = uuidd;
        return uuidd;
    });

    scrubber.when(function (x) {
        return !_.isArray(x.value) && _.isObject(x.value) && !uuid.isValid(x.value);
    }, function (x) {
        x.scrub(x.value);
    });

    var result = scrubber.scrub(object);
    return result;
}

var outbound = function (object) {
    var scrubber = new Scrubber();

    scrubber.when(function (x) {
        return x.parent && x.key === '_id';
    }, function (x) {
        x.parent.id = x.value;
        delete x.parent._id;
        x.key = 'id';

        if (!_.isArray(x.value) && uuid.isValid(x.value))
            x.parent.id = x.value.toString();
    });

    scrubber.when(function (x) {
        return !_.isArray(x.value) && uuid.isValid(x.value) && x.value._bsontype;
    }, function (x) {
        return x.value.toString();
    });

    scrubber.when(function (x) {
        return _.isArray(x.value);
    }, function (x) {
        if (_.all(x.value, function (a) { return uuid.isValid(a); })) {
            _.each(x.value, function (v, i) {
                if (v)
                    x.value[i] = v.toString();
            });
        }
        else {
            x.scrub(x.value);
        }
    });

    scrubber.when(function (x) {
        return !_.isArray(x.value) && _.isObject(x.value) && !uuid.isValid(x.value);
    }, function (x) {
        x.scrub(x.value);
    });

    var result = scrubber.scrub(object);
    return result;
}

/** @module mongodb-proxy/Store */

/**
 * The base processor.
 * @constructor 
 * @abstract
 * @private
 */
var OptionsProcessor = function () {

};

OptionsProcessor.prototype.get = function () {
    return {};
};

/** 
 * The processor for read actions.
 * @constructor
 */
var ReadOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._query = undefined;
    this._fields = undefined;
    this._options = { };
};
ReadOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

/**
 * Set the query 
 * 
 * @param {object} query - The query object
 * 
 * @example
 * x.query({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
ReadOptionsProcessor.prototype.query = function (query) {

    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        this._query = extend(true, {}, query);
        inbound(this._query);
    }
    else if (_.isString(query) && uuid.isValid(query)) {
        this._query = uuid.create(query);
    }

};

/**
 * Set the fields 
 * 
 * @param {object|array} fields - The restricted fields
 * 
 * @example
 * x.fields(['firstName', 'lastName']);
 * 
 * @example
 * x.fields({
 *    firstName: 1,
 *    lastName: 1
 * }); 
 */
ReadOptionsProcessor.prototype.fields = function (fields) {
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

/**
 * Set the options 
 * 
 * @param {object} options - The options
 * 
 * @example
 * x.options({
 *    start: 0,
 *    limit: 50,
 *    sort: { firstName: 1 }
 * }});
 */
ReadOptionsProcessor.prototype.options = function (options) {
    extend(true, this._options, options);
};

ReadOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        fields: this._fields,
        options: this._options
    };
};

/** 
 * The processor for get actions.
 * @constructor
 */
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

/**
 * Set the query 
 * 
 * @param {object|string} query - The query object or the mongodb ObjectId
 * 
 * @example
 * x.query('XXX');
 * 
 * @example
 * x.query({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
GetOptionsProcessor.prototype.query = function (query) {

    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        this._query = extend(true, {}, query);
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

/**
 * Set to fetch a single result 
 * 
 * @param {boolean} [value=true] - Whether it should fetch a single result or not
 * 
 * @example
 * x.single();
 */
GetOptionsProcessor.prototype.single = function (value) {
    this._single = value === undefined || value === true;
};

/**
 * Set to cache the result 
 * 
 * @example
 * x.cached();
 */
GetOptionsProcessor.prototype.cached = function () {
    this._cached = true;
};

/**
 * Set the fields 
 * 
 * @param {object|array} fields - The restricted fields
 * 
 * @example
 * x.fields(['firstName', 'lastName']);
 * 
 * @example
 * x.fields({
 *    firstName: 1,
 *    lastName: 1
 * }); 
 */
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

/**
 * Set the options 
 * 
 * @param {object} options - The options
 * 
 * @example
 * x.options({
 *    start: 0,
 *    limit: 50,
 *    sort: { firstName: 1 }
 * }});
 */
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

/** 
 * The processor for count actions.
 * @constructor
 */
var CountOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._query = undefined;
};
CountOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

/**
 * Set the query 
 * 
 * @param {object} query - The query object
 * 
 * @example
 * x.query({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
CountOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        this._query = extend(true, {}, query);
        inbound(this._query);
    }
};

CountOptionsProcessor.prototype.get = function () {
    return {
        query: this._query
    };
};

/** 
 * The processor for post actions.
 * @constructor
 */
var PostOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._single = true;
    this._data = undefined;
};
PostOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

/**
 * Set the data to post 
 * 
 * @param {object} data - The data object
 * 
 * @example
 * x.data({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
PostOptionsProcessor.prototype.data = function (data) {
    this._data = _.isArray(data) ?
        _.map(data, function (x) {
            return extend(true, {}, x, {
                id: uuid.create().toString()
            });
        }) :
        extend(true, {}, data, {
            id: uuid.create().toString()
        });

    if (_.isArray(this._data))
        this._single = false;
};

PostOptionsProcessor.prototype.get = function () {
    return {
        data: this._data,
        single: this._single
    };
};

/** 
 * The processor for put actions.
 * @constructor
 */
var PutOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._single = true;
    this._query = undefined;
};
PutOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

/**
 * Set the query 
 * 
 * @param {object} query - The query object
 * 
 * @example
 * x.query({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
PutOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        this._query = extend(true, {}, query);
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

/**
 * Set the data to post 
 * 
 * @param {object} data - The data object
 * 
 * @example
 * x.data({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
PutOptionsProcessor.prototype.data = function (data) {
    var self = this;

    this._data = extend(true, {}, data);
};

PutOptionsProcessor.prototype.get = function () {
    return {
        query: this._query,
        data: this._data,
        single: this._single
    };
};

/** 
 * The processor for del actions.
 * @constructor
 */
var DelOptionsProcessor = function () {
    OptionsProcessor.apply(this, arguments);

    this._query = undefined;
};
DelOptionsProcessor.prototype = Object.create(OptionsProcessor.prototype);

/**
 * Set the query 
 * 
 * @param {object} query - The query object
 * 
 * @example
 * x.query({
 *    firstName: 'John',
 *    lastName: 'Smith'
 * });
 */
DelOptionsProcessor.prototype.query = function (query) {
    this._query = query;

    if (_.isObject(query) && !uuid.isValid(query.toString())) {
        this._query = extend(true, {}, query);
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