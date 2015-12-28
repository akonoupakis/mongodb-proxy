var Cache = function () {
    
};
Cache.prototype.add = function (key, value, cb) {
    cb(null, value);
};

Cache.prototype.get = function (key, cb) {
    cb(null, null);
};

Cache.prototype.purge = function (key, cb) {
    cb(null, null);
};

Cache.prototype.getKeys = function (key, cb) {
    cb(null, []);
};

module.exports = Cache;