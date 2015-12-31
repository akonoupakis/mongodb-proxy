$(document).ready(function () {

    //$.ajax({
    //    url: "/api/categories",
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories', results);
    //});

    //$.ajax({
    //    url: "/api/categories/",
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories/', results);
    //});

    //$.ajax({
    //    url: "/api/categories/one",
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories/one', results);
    //});

    //$.ajax({
    //    url: "/api/categories/56802653a5261282c30acc28",
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories/56802653a5261282c30acc28', results);
    //});

    //$.ajax({
    //    url: "/api/categories?q=" + encodeURIComponent(JSON.stringify({
    //        alpha: 1,
    //        $cached: true
    //    })),
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories?q=', results);
    //});

    //$.ajax({
    //    url: "/api/categories/count?q=" + encodeURIComponent(JSON.stringify({
    //        alpha: 1
    //    })),
    //    context: document.body
    //}).done(function (results) {
    //    console.log('/api/categories/count?q=', results, typeof(results));
    //});

    
    //$.ajax({
    //    url: "/api/users?q=" + encodeURIComponent(JSON.stringify({
    //        id: '56847b11384b0e883ca4e8e2'
    //    })),
    //    type: 'PUT',
    //    dataType: 'json',
    //    headers: { "X-HTTP-Method-Override": "PUT" },
    //    data: JSON.stringify({
    //        lastName: 'asd'
    //    }),
    //    success: function (result) {
    //        console.log("success?", result);
    //    }
    //}).error(function (err) {
    //    console.log(err);
    //}).done(function (results) {
    //    console.log(results);
    //});


    $.ajax({
        url: "/api/users",
        type: 'POST',
        dataType: 'json',
        headers: { "X-HTTP-Method-Override": "PUT" },
        data: JSON.stringify({
            firstName: 'user',
            lastName: 'user',
            password: '1'
        }),
        success: function (result) {
            console.log("success?", result);
        }
    }).error(function (err) {
        console.log(err);
    }).done(function (results) {
        console.log(results);
    });

    //$.ajax({
    //    url: "/api/users?q=" + encodeURIComponent(JSON.stringify({
    //        id: '5684858758d362402d0cd620'
    //    })),
    //    type: 'DELETE',
    //    dataType: 'json',
    //    headers: { "X-HTTP-Method-Override": "PUT" },
        
    //    success: function (result) {
    //        console.log("success?", result);
    //    }
    //}).error(function (err) {
    //    console.log(err);
    //}).done(function (results) {
    //    console.log(results);
    //});
});