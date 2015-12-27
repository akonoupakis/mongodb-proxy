var mongodb = require('mongodb');

module.exports = {

    create: function (value) {

        var idValue = value;
        if (typeof (value) === 'object' && typeof (value.toString) === 'function')
            idValue = value.toString();

        var id = new mongodb.ObjectID(idValue);
        return id;
    },

    isValid: function (value) {
        if (typeof (value) === 'string')
            return mongodb.ObjectID.isValid(value);
        else
            if (typeof (value.toString) === 'function')
                return mongodb.ObjectID.isValid(value.toString());

        return false;
    }

};