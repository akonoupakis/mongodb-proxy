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

exports.count = function (test) {
 
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