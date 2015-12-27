var proxy = require('../lib/index.js');
var _ = require('underscore');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017
};

var nodeId = '56802653a5261282c30acc2a';

var db = proxy.create(options);

exports.findOne = function (test) {

    var store = db.createStore('categories');
    store.get(function (x) {
        x.query({ id: nodeId });
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (res === null || _.isObject(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }
        
        test.done();
    });

};

exports.findOne2 = function (test) {

    var store = db.createStore('categories');
    store.get(function (x) {
        x.query({
            CategoryName: 'Beverages'
        });
        x.single();
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (res === null || _.isObject(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.findMany = function (test) {

    var store = db.createStore('categories');
    store.get(function (x) {
        x.query({
            id: {
                $in: [nodeId]
            }
        });
        //x.fields(['CompanyName']);
        //x.options({});
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isArray(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.count = function (test) {

    var store = db.createStore('categories');
    store.count(function (x) {
        x.query({
            id: {
                $in: [nodeId]
            }
        });
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isNumber(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.postOne = function (test) {

    var store = db.createStore('categories');
    store.post(function (x) {
        x.data({
            alpha: 1,
            vita: 2,
            gama: 3,
            nodeId: '56802653a5261282c30acc27'
        });
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isObject(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.postMany = function (test) {

    var store = db.createStore('categories');
    store.post(function (x) {
        x.data([{
            alpha: 11,
            vita: 22,
            gama: 33,
            nodeId: '56802653a5261282c30acc27',
            nodeIds: ['56802653a5261282c30acc27']
        }, {
            alpha: 44,
            vita: 55,
            gama: 66,
            nodeId: '56802653a5261282c30acc27'
        }]);
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isObject(res)) {
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.put = function (test) {

    var store = db.createStore('categories');
    store.put(function (x) {
        x.query({
            CategoryID: 4
        });
        x.data({
            alpha: 4,
            vita: 23
        });
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isNumber(res)) {                
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};

exports.del = function (test) {

    var store = db.createStore('employees');
    store.del(function (x) {
        x.query({ "_id": '56804dbdb2a66c2c47f60180' });
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isNumber(res)) {                
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};
