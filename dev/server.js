var express = require('express');
var proxy = require('../lib/index.js');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017
};

var db = proxy.create(options);

var app = express();

app.all('/api/:collection*', function (req, res, next) {
    
    var route = {
        method: req.method,
        collection: req.params.collection,
        path: req._parsedUrl.pathname.substring('/api/'.length + req.params.collection.length),
        query: req.query.q,
        data: req.body
    };

    db.handle(route, next, function (error, results) {
        if (error) {
            res.status(500).send(error.message);
        }
        else {
            res.send(results);
        }
    });
      
});

app.use(express.static('src'));

app.listen(9999);
console.log('listening on 9999');