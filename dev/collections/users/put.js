module.exports = function (sender, context, data) {

 //   console.log('users put', data);
    console.log('users eput', context.previous, context.data, data);

    console.log('firstName changed: ' + context.changed('firstName'));
    console.log('lastName changed: ' + context.changed('lastName'));

    context.done();
    
}