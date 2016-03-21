var express = require('express')

//var proxy = require('../lib/index.js');
//var MemCache = require('../lib/caching/MemCache.js');

// var options = {
//     name: 'jsnbt-dev',
//     host: 'localhost',
//     port: 27017
// };

//var db = proxy.create(options);

// db.configure(function (config) {

//     config.register({
//         name: 'nodes'
//     })
// });

var app = express()

app.all('/:collection*', function (req, res, next) {
  var route = {
    method: req.method,
    collection: req.params.collection,
    path: req._parsedUrl.pathname.substring(req.params.collection.length + 1),
    query: req.query.q,
    data: req.body,
    req: req,
    res: res
  }

  req.on('end', function () {
    // var jsonData = JSON.parse(postdata || '{}')
    // route.data = jsonData

    // db.handle(route, next, function (error, results) {
    //   if (error) {
    //     if (typeof (error) === 'object') {
    //       if (error.code && error.messages) {
    //         res.status(error.code).send(error.messages)
    //       } else {
    //         res.status(500).send(error.message)
    //       }
    //     } else {
    //       res.status(500).send(error)
    //     }
    //   } else {
    //     res.send(results)
    //   }
    // })

    res.send({
      path: route.path,
      query: route.query
    })
  })

  var postdata = ''
  req.on('data', function (postdataChunk) {
    postdata += postdataChunk
  })
})

app.listen(9999)
console.log('listening on 9999')
