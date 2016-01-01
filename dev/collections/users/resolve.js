module.exports = function (sender, context, data) {

    console.log(111, data);
    if (!context.internal)
        context.hide('password');

    context.done();
    
}