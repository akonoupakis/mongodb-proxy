var express = require('express');
var proxy = require('../lib/index.js');
var _ = require('underscore');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017
};

var db = proxy.create(options);

var app = express();

app.get('/', function (req, res) {

    var nodeId = '56802653a5261282c30acc27';
    var store = db.createStore('categories');

    store.get(function (x) {
        x.query({ id: nodeId });
    }, function (err, response) {
        if (err) {
            res.send(err);
        }
        else {
            res.send(response);
        }
    });


})

app.listen(9999);
console.log('listening on 9999');