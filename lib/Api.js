var extend = require('extend');
var _ = require('underscore');

var Api = function (database) {
    
    this.db = database;
    
    for (var collectionName in this.db.collections) {
        var collection = this.db.collections[collectionName];
        this[collection.name] = new CollectionApi(this.db, collection.name);
    }

};

module.exports = Api;


function stripFields(query) {
    if (!query) return;
    var fields = query.$fields;
    if (fields) delete query.$fields;
    return fields;
}

function stripOptions(query) {
    var options = {};
    if (!query) return options;

    if (query.$limit) options.limit = query.$limit;
    if (query.$skip) options.skip = query.$skip;
    if (query.$sort || query.$orderby) options.sort = query.$sort || query.$orderby;
    delete query.$limit;
    delete query.$skip;
    delete query.$sort;
    return options;
}

function stripSingle(query) {
    if (!query) return undefined;
    var single = query.$single;
    if (single !== undefined) {
        delete query.$single;
        return single;
    }

    return undefined;
}

function stripCached(query) {
    if (!query) return undefined;
    var cached = query.$cached;
    if (cached !== undefined) {
        delete query.$cached;
        return cached;
    }

    return undefined;
}

var CollectionApi = function (db, name) {
    this.name = name;
    this.store = db.createStore(name);
};
CollectionApi.prototype.get = function (query, cb) {

    this.store.get(function (x) {
        var fields = stripFields(query);
        var options = stripOptions(query);
        var single = stripSingle(query);
        var cached = stripSingle(cached);
        
        x.query(query);
        x.fields(fields);
        x.options(options);

        if (single)
            x.single(single);

        if (cached)
            x.cached();

    }, cb);

};

CollectionApi.prototype.post = function (data, cb) {
    var _data = extend(true, data);

    this.store.post(function (x) {
        x.data(_data);
    }, function (error, result) {
        if (error) {
            cb(error);
        }
        else {
            cb(null, {
                inserted: result
            });
        }
    });

};

CollectionApi.prototype.put = function (query, data, cb) {
    var _data = extend(true, data);

    this.store.put(function (x) {
        x.query(query);
        x.data(_data);
    }, function (error, result) {
        if (error) {
            cb(error);
        }
        else {
            cb(null, {
                updated: result
            });
        }
    });

};

CollectionApi.prototype.count = function (query, cb) {

    this.store.count(function (x) {
        x.query(query);
    }, function (error, result) {
        if (error) {
            cb(error);
        }
        else {
            cb(null, {
                count: result
            });
        }
    });

};

CollectionApi.prototype.del = function (query, cb) {

    this.store.del(function (x) {
        x.query(query);
    }, function (error, result) {
        if (error) {
            cb(error);
        }
        else {
            cb(null, {
                deleted: result
            });
        }
    });

};