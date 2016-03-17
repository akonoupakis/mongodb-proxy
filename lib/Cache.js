/**
 * The data cache. 
 * This is just a dummy implementation that could be overriden by a plugguble module.
 * @constructor
 */

var Cache = function () {
    
};

/**
 * Add to cache.
 * 
 * @param {string} key - The cache key
 * @param {string|object|array} value - The value to cache
 * @param {Cache~addCallback} cb - The callback function
 */
Cache.prototype.add = function (key, value, cb) {
    
    /**
    * @callback Cache~addCallback
    * @param {object} err - The exception object
    * @param {object} res - The cached results
    */
        
    cb(null, value);
};

/**
 * Get from cache.
 * 
 * @param {string} key - The cache key
 * @param {Cache~getCallback} cb - The callback function
 */
Cache.prototype.get = function (key, cb) {

    /**
    * @callback Cache~getCallback
    * @param {object} err - The exception object
    * @param {object} res - The cached results
    */
        
    cb(null, null);
};

/**
 * Purge from cache.
 * 
 * @param {string} key - The cache key
 * @param {Cache~purgeCallback} cb - The callback function
 */
Cache.prototype.purge = function (key, cb) {

    /**
    * @callback Cache~purgeCallback
    * @param {object} err - The exception object
    * @param {object} res - The results
    */
        
    cb(null, null);
};

/**
 * Get the cache keys.
 * 
 * @param {string} key - A prefix key
 * @param {Cache~getKeysCallback} cb - The callback function
 */
Cache.prototype.getKeys = function (key, cb) {
    
    /**
    * @callback Cache~getKeysCallback
    * @param {object} err - The exception object
    * @param {object} res - The result keys
    */
    
    cb(null, []);
};

module.exports = Cache;