var express = require('express');
var proxy = require('../lib/index.js');
//var MemCache = require('../lib/caching/MemCache.js');

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

    config.register({
        name: 'users',
        schema: {
            type: 'object',
            required: true,
            properties: {
                firstName: {
                    type: 'string',
                    required: true
                },
                lastName: {
                    type: 'string',
                    required: true
                },
                password: {
                    type: 'string',
                    required: true
                }
            }
        },
        events: {
            get: require('./collections/users/get.js'),
            put: require('./collections/users/put.js'),
            post: require('./collections/users/post.js'),
            validate: require('./collections/users/validate.js'),
            resolve: require('./collections/users/resolve.js')
        }
    });

    //config.cache(new MemCache());
});

db.bind('preread', function (sender, collection, context, data) {
    context.error(500, {
        denied: 'read not allowed'
    });
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