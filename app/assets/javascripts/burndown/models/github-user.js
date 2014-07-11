/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// GithubUser Model
	// ----------------
    app.GithubUser = Backbone.Model.extend({
        initialize: function(user) {
            var name = user.login ? user.login : '';
            var gravatar = user.gravatar_id ? user.gravatar_id : '';
            var url = user.html_url ? user.html_url : '';

            this.set('name', name);
            this.set('gravatar', gravatar);
            this.set('url', url);
        },

        getLink: function() {
            var rval = ['<a href="' + this.get('url') + '" title="' + this.get('name') + '">',
                        this.getIcon(),
                        this.get('name'),
                        '</a>'].join('');

            return rval;
        },

        getIcon: function() {
            var rval = ['<img src="http://www.gravatar.com/avatar/',
                        this.get('gravatar'),
                        '?s=40" title="' + this.get('name') + '">'].join('');

            return rval;
        }
    });
})();
