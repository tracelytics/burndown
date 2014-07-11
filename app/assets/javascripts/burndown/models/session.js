/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// Session Model
	// -------------
    var Session = Backbone.Model.extend({
        defaults: {
            'owner': '',
            'repo': ''
        },

        initialize: function() {
            var self = this;
            _.bindAll(this, 'getURL');
            $.getJSON('/sessions/get', function(response) {
                var data = response.data;
                var token = null;
                if (response.status == "ok" && data.token) {
                    console.log('session created!');
                    token = data.token;
                }
                self.set('token', token);
            });
        },

        getURL: function() {
            var self = this;
            return self.get('owner') + '/' + self.get('repo');
        }
    });

    app.session = new Session();

})();
