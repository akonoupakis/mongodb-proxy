var express = require('express');
var proxy = require('../lib/index.js');
var MemCache = require('../lib/caching/MemCache.js');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017
};

var db = proxy.create(options);

db.configure(function (config) {
    config.register({
        name: 'categories'//,
        //schema: {}
    });

    config.cache(new MemCache());
});

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
            if (typeof (error) === typeof (Error)) {
                res.status(500).send(error.message);
            }
            else {
                res.status(400).send(error);
            }
        }
        else {
            res.send(results);
        }
    });
      
});

app.use(express.static('src'));

app.listen(9999);
console.log('listening on 9999');