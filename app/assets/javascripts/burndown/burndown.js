/*global $ */
/*jshint unused:false */
var app = app || {};

$(function () {
	'use strict';

    // Create our global session.
    app.session = new app.Session();

    // Once the session token finishes loading, start the application!
    app.session.once('change:token', function(model, value) {
        console.log('token: ', value);

        // Let's get this party started!
        Backbone.history.start();
    });
});
