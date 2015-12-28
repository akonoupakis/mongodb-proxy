var fs = require('fs');;
var path = require('path');
var proxy = require('../lib/index.js');
var _ = require('underscore');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017
};

var db = proxy.create(options);

var tasks = [];

var jsonFiles = fs.readdirSync('./collections');
_.each(jsonFiles, function (jsonFile) {
    var contents = require('./collections/' + jsonFile);
    if (contents) {
        db.configure(function (x) {
            x.register({
                name: path.basename(jsonFile, '.json'),
                schema: {},
                default: {}
            })
        })
        tasks.push(function (next) {

            var api = db.createApi();
            api[path.basename(jsonFile, '.json')].post(contents, function (err, results) {
                if (err) {
                    throw err;
                }
                else {
                    next(results);
                }
            })

        });

    }
});

tasks.push(function (next) {
    process.exit(0);
});

var processTask = function () {
    var task = tasks.shift();
    if (task) {
        task(processTask);
    }
}

processTask();