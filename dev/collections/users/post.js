module.exports = function (sender, context, data) {

    console.log('users post', context.previous, context.data, data);
    context.done();
    
}