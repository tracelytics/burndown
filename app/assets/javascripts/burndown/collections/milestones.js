/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// Milestones Collection
	// ---------------------
    var Milestones = app.PaginatedCollection.extend({
        model: app.Milestone,

        comparator: function(milestone) {
            return milestone.get('created_at');
        },

        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/milestones',
                       '?access_token=',
                       token].join('');

            // If any parameter properties exist, append then to the URL string.
            if (this.state) {
                url += '&state='+this.state;
            }

            return url;
        },

        parse: function(response) {
            console.log('parsing...');
            return response;
        },

        getByNumber: function(id) {
            var number = parseInt(id, 10);
            return this.findWhere({number: number});
        },

        // Default to 'open'. Can also be set to 'closed'.
        state: 'open'
    });

    app.milestones = new Milestones();

})();
