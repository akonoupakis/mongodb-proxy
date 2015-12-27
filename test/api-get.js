var proxy = require('../lib/index.js');
var _ = require('underscore');

var options = {
    name: 'jsnbt-dev',
    host: 'localhost',
    port: 27017
};

var nodeId = 'aff6ca416591bb8b';

var db = proxy.create(options);

var store = db.createStore('nodes');

exports.findOne = function (test) {

    store.get(function (x) {
        x.query(nodeId);
        //x.fields(['seo']);
        x.fields({
            title: 1
        });
        x.options();
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isObject(res)) {
                console.log(res);
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
 
    store.get(function (x) {
        x.query({
            id: {
                $in: [nodeId]
            }
        });
        x.fields(['title.en']);
        x.options({});
    }, function (err, res) {
        if (err) {
            test.ok(false, err);
        }
        else {
            if (_.isArray(res)) {
                console.log(res);
                test.ok(true);
            }
            else {
                test.ok(false);
            }
        }

        test.done();
    });

};