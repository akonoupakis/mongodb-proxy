var extend = require('extend');
var _ = require('underscore');

/**
 * @class
 * @augments Error
 * Represents an Error object.
 * @constructor
 * 
 * @param {number|object} code - The error status code or the messages object
 * @param {string|object} messages - The messages object or a message string
 * 
 * @property {number} code - The error status code
 * @property {object} messages - The error messages
 */
var Exception = function (code, message) {
    var self = this;

    Error.apply(this, arguments);
    
    var errMessage = message || code;
    
    this.messages = {};
    this.code = _.isNumber(code) ? code : 400;

    if (_.isObject(errMessage)) {
        extend(true, self.messages, errMessage);
    }
    else if(_.isString(errMessage)) {
        this.messages[this.code] = errMessage;
    }
};
Exception.prototype = Object.create(Error.prototype);

module.exports = Exception;