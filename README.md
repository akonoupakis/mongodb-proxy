# mongodb-proxy

> A proxy for mongo databases.

## Install

Install with [npm](https://www.npmjs.com/)

```sh
$ npm install mongodb-proxy --save
```

### Usage

```js
var proxy = require('mongodb-proxy');

var options = {
    name: 'Northwind',
    host: 'localhost',
    port: 27017,
    credentials: {
        user: 'user',
        password: 'password'
    }
};

var db = proxy.create(options);

db.configure(function (config) {
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
            get: function (sender, context, data) {
                context.done();
            },
            put: ...
            post: ...
            validate: ...
            resolve: ...
        }
    });
});
```

### Using the proxy

```js
var store = db.createStore('users');

//=> posting
store.post(function (x) {
    x.data({
        firstName: 'John',
        lastName: 'Smith',
        password: 'test'
    });
}, function (err, res) {
    console.log(err, res);
});

//=> getting (using .toArray() internally)
store.get(function (x) {
    x.query({
        id: 'xx'
    });
    x.fields(['firstName']);
    x.options({
        limit: 2
    });
    
    x.single(true); //=> indicate that a single object is expected
    x.cached(); //=>  indicate that the response should be cached for later use
}, function (err, res) {
    console.log(err, res);
});

//=> updating
store.put(function (x) {
    x.query({
        id: 'xx'
    });
    x.data({
       lastName: 'Something else',
    });
}, function (err, res) {
    console.log(err, res);
});

//=> deleting
store.del(function (x) {
    x.query({
        id: 'xx'
    });
}, function (err, res) {
    console.log(err, res);
});

//=> counting
store.count(function (x) {
    x.query({
        firstName: 'John'
    });
}, function (err, res) {
    console.log(err, res);
});

//=> reading (using a mongodb cursor)
var results = [];
store.read(function (x) {
    x.query();
    x.fields(['firstName']);
    x.options({
        limit: 100
    });
}, function (err, res) {
	if(err)
		throw err;

	results.push(res);
}, function() {
	console.log('completed!', results);
});
```


### Using the api
The api uses internally stores to cope with results with different query structures.
For rest implementations, we would find easier to bind to the api rather than the stores themselves.

```js
var api = db.createApi();

//=> posting
api.users.post({
    firstName: 'John',
    lastName: 'Smith',
    password: 'test'
}, function (err, res) {
    console.log(err, res);
});

//=> reading
api.users.get({
    id: 'xx',
    $fields: ['firstName'],
    $options: {
        limit: 2
    },
    $single: true,
    $cached: true
}, function (err, res) {
    console.log(err, res);
});

//=> updating
api.users.put({
    id: 'xx'
}, {
    lastName: 'Something else',
}, function (err, res) {
    console.log(err, res);
});

//=> deleting
api.users.del({
    id: 'xx'
}, function (err, res) {
    console.log(err, res);
});

//=> counting
api.users.count({
    firstName: 'John'
}, function (err, res) {
    console.log(err, res);
});
```

### Exposing the api

```js
var express = require('express');

var app = express();

//=> listen for all requests under an '/api' location
app.all('/api/:collection*', function (req, res, next) {

    //=> prepare an info object for the routing function    
    var route = {
        method: req.method,
        collection: req.params.collection,
        path: req._parsedUrl.pathname.substring('/api/'.length + req.params.collection.length),
        query: req.query.q,
        data: req.body,
        req: req,
        res: res
    };
    
    //=> get the post data
    req.on('end', function () {
        var jsonData = JSON.parse(postdata || '{}');
        route.data = jsonData;
        
        //=> pass the work on the proxy
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

app.listen(9999);
```

The url structure for a collection would be as:

GET /users => fetching all entries

GET /users/56802653a5261282c30acc28 => fetching a single entry

GET /users?q= + encodeStringified({firstName:'John'}) => fetching with an api query

GET /users/count?q= + encodeStringified({firstName:'John'}) => fetching the count for the query

POST /users => posting data (with form data)

PUT /users/56802653a5261282c30acc28 => updating an entry (with form data)

DEL /users/56802653a5261282c30acc28 => deleting an entry

```js
//=> posting
$.ajax({
    url: "/api/users",
    type: 'POST',
    dataType: 'json',
    data: JSON.stringify({
        firstName: 'John',
        lastName: 'Smith',
        password: 'test'
    })
}).error(function (err) {
    console.log(err);
}).done(function (results) {
    console.log(results);
});

//=> reading
$.ajax({
    url: "/api/users?q=" + encodeURIComponent(JSON.stringify({
        id: 'xx',
        $fields: ['firstName'],
        $options: {
            limit: 2
        },
        $single: true,
        $cached: true
    })),
}).done(function (results) {
    console.log(results);
});

//=> updating
$.ajax({
    url: "/api/users?q=" + encodeURIComponent(JSON.stringify({
        id: 'xx'
    })),
    type: 'PUT',
    dataType: 'json',
    data: JSON.stringify({
        lastName: 'Something else'
    })
}).error(function (err) {
    console.log(err);
}).done(function (results) {
    console.log(results);
});

//=> deleting
$.ajax({
    url: "/api/users?q=" + encodeURIComponent(JSON.stringify({
        id: 'xx'
    })),
    type: 'DELETE',
    dataType: 'json'
}).error(function (err) {
    console.log(err);
}).done(function (results) {
    console.log(results);
});

//=> counting
$.ajax({
    url: "/api/users/count?q=" + encodeURIComponent(JSON.stringify({
        firstName: 'John'
    })),
    type: 'GET',
    dataType: 'json'
}).error(function (err) {
    console.log(err);
}).done(function (results) {
    console.log(results);
});
```

### Events

```js
//=> bind general events on the db instance
db.bind('predelete', function (sender, collection, context, data) {
    if(collection === 'users') {
        context.error(401, {
            denied: 'delete not allowed'
        });
    } else {
        context.done();
    }
});

//=> bind collection specific events on configuation
db.configure(function (config) {
    config.register({
        name: 'users',
        schema: { },
        events: {
            get: function(sender, context, data) {
                data.test = 'test';

                context.done();
            },
            validate: function(sender, context, data) {
                context.validate({
                    type: 'object',
                    required: true,
                    properties: {
                        firstName: {
                            type: 'string',
                            required: true
                        }
                    }
                });

                context.done();
            },
            put: function(sender, context, data) {
                if(context.changed('firstName'))
                    console.log('first name is changed from ' + context.previous.firstName + ' to ' + data.firstName);

                context.done();
            },
            post: function(sender, context, data) {
                context.error(401, {
                    'denied': 'no new users allowed'
                });
            },
            resolve: function(sender, context, data) {
                context.hide('password');

                context.done();
            }
        }
    });
});
```


### Cache

```js
//=> the proxy uses a null cache, but you may implement one and inject it for usage
var MemCache = require('mongodb-proxy-memcache');

db.configure(function (config) {
    config.cache(new MemCache());
});
```

## license

    The MIT License (MIT)

    Copyright (c) 2015 akon

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
