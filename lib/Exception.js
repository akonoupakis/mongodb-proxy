var extend = require('extend');
var _ = require('underscore');

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