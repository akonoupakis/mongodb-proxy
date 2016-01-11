var express = require('express');
var proxy = require('../lib/index.js');
//var MemCache = require('../lib/caching/MemCache.js');

var options = {
    name: 'jsnbt-dev',
    host: 'localhost',
    port: 27017
};

var db = proxy.create(options);

db.configure(function (config) {

    config.register({
        name: 'nodes'
    });

    config.bind('preread', function (sender, collection, context, data) {
        //context.error(500, {
        //    denied: 'read not allowed'
        //});
        context.done();
    });

    //config.cache(new MemCache());
});

var app = express();

app.get('/read', function (req, res) {
    
    var store = db.createStore('nodes');

    var results = [];

    store.read(function (x) {
        x.query({});
    }, function (err, result) {
        if (err)
            throw err;

        results.push(result);
    }, function () {
        res.send(results);
    });
});

app.all('/api/:collection*', function (req, res, next) {
    
    var route = {
        method: req.method,
        collection: req.params.collection,
        path: req._parsedUrl.pathname.substring('/api/'.length + req.params.collection.length),
        query: req.query.q,
        data: req.body,
        req: req,
        res: res
    };
    
    req.on('end', function () {
        var jsonData = JSON.parse(postdata || '{}');
        route.data = jsonData;
        
        db.handle(route, next, function (error, results) {
            if (error) {
                if (typeof (error) === 'object') {
                    if (error.code && error.messages) {
                        res.status(error.code).send(error.messages);
                    }
                    else {
                        res.status(500).send(error.message);
                    }
                }
                else {
                    res.status(500).send(error);
                }
            }
            else {
                res.send(results);
            }
        });
    });

    var postdata = "";
    req.on('data', function (postdataChunk) {
        postdata += postdataChunk;
    });  
});

app.use(express.static('src'));

app.listen(9999);
console.log('listening on 9999');