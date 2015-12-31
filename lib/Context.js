var Exception = require('./Exception.js');
var jsonValidation = require('json-validation');
var objectSearch = require('object-search');

var _ = require('underscore');

var Context = function (store, data, previous, callback) {
    this.internal = store.internal;
    this.store = store;
    this.data = data;
    this.previous = previous;
    this.callback = callback;
};

Context.prototype.error = function (code, err) {
    var message = err || code;
    var resultCode = _.isNumber(code) ? code : 400;

    this.callback(new Exception(resultCode, message));
};

Context.prototype.done = function () {
    this.callback(null, this.data);
};

Context.prototype.changed = function (property) {
    var source = objectSearch.get(this.previous, property);
    var target = objectSearch.get(this.data, property);

    return !_.isEqual(source, target);
};

Context.prototype.hide = function (property) {
    if (this.data[property])
        delete this.data[property];
};

Context.prototype.validate = function (schema) {
    var validator = new jsonValidation.JSONValidation();
    var validationResult = validator.validate(this.data, schema);
    if (!validationResult.ok) {
        var validationErrors = {};
        validationErrors[validationResult.path] = validationResult.errors;
        return this.error(400, validationErrors);
    }
    else {
        return true;
    }
};

module.exports = Context;