module.exports = function (sender, context, data) {

    //console.log('users get2 1');

    var api = sender.createApi();
    api.categories.count({}, function (err, results) {
        //console.log(2, results);
        //console.log('users get2 2');

        context.done();
    });

}