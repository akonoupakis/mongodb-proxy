var mongodb = require('mongodb');
var _ = require('underscore');

var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGIJKLMNOPQRSTUVWXYZ0123456789'.split('');

var isValidString = function(value){
    return value.length === 24 && _.all(value.split(''), function(x) { return chars.indexOf(x) !== -1; });      
};

module.exports = {

    create: function (value) {

        var idValue = value;
        if (value && typeof (value) === 'object' && typeof (value.toString) === 'function')
            idValue = value.toString();

        var id = new mongodb.ObjectID(idValue);
        return id;
    },

    isValid: function (value) {
        if (value) {
            if (typeof (value) === 'string') {
                return mongodb.ObjectID.isValid(value) && isValidString(value);
            }
            else if (_.isArray(value)) {
                return _.all(value, function(x) { 
                    return _.isString(x) && isValidString(x);                    
                });   
            }
            else {
                if (typeof (value.toString) === 'function')
                    return mongodb.ObjectID.isValid(value.toString());
            }
        }

        return false;
    }

};