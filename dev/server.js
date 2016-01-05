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

app.get('/scrub', function (req, res, next) {
    
    var testObj = {
        title: {
            en: "home22"
        },
        domain: "core",
        entity: "page",
        parent: "",
        layouts: {
            inherits: true,
            value: []
        },
        content: {
            localized: {}
        },
        seo: {
            en: "home"
        },
        active: {
            en: true
        },
        secure: {
            inherits: true,
            value: false
        },
        meta: {
            en: {
                title: "home"
            }
        },
        createdOn: 1448308799152,
        modifiedOn: 1449591780217,
        roles: {
            inherits: false,
            value: [
            "public"
            ]
        },
        robots: {
            inherits: true,
            value: []
        },
        hierarchy: [
        "56857190f7c6ae3434567838"
        ],
        hierarchy2: [
            "56857190f7c6ae3434567831",
            "56857190f7c6ae3434567832",
            "56857190f7c6ae3434567833",
            "56857190f7c6ae3434567834"
        ],
        hierarchy3: [[
            "56857190f7c6ae3434567831",
            "56857190f7c6ae3434567832",
            "56857190f7c6ae3434567833",
            "56857190f7c6ae3434567834"
        ], [
            "56857190f7c6ae3434567831",
            "56857190f7c6ae3434567832",
            "56857190f7c6ae3434567833",
            "56857190f7c6ae3434567834"
        ]],
        template: "home",
        id: { $in: ["56857190f7c6ae3434567838"] }
    };

    var scrubber = require('../lib/ObjectScrubber/ObjectScrubber.js')();
    scrubber.scrub(testObj);
    console.log('transformed', testObj);
    res.send(testObj);
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