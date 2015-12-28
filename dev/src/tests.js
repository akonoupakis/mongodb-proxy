$(document).ready(function () {

    $.ajax({
        url: "/api/categories",
        context: document.body
    }).done(function (results) {
        console.log('/api/categories', results);
    });

    $.ajax({
        url: "/api/categories/",
        context: document.body
    }).done(function (results) {
        console.log('/api/categories/', results);
    });

    $.ajax({
        url: "/api/categories/one",
        context: document.body
    }).done(function (results) {
        console.log('/api/categories/one', results);
    });

    $.ajax({
        url: "/api/categories/56802653a5261282c30acc28",
        context: document.body
    }).done(function (results) {
        console.log('/api/categories/56802653a5261282c30acc28', results);
    });

    $.ajax({
        url: "/api/categories?q=" + encodeURIComponent(JSON.stringify({
            alpha: 1,
            $cached: true
        })),
        context: document.body
    }).done(function (results) {
        console.log('/api/categories?q=', results);
    });

    $.ajax({
        url: "/api/categories/count?q=" + encodeURIComponent(JSON.stringify({
            alpha: 1
        })),
        context: document.body
    }).done(function (results) {
        console.log('/api/categories/count?q=', results, typeof(results));
    });

    console.log(1);

});