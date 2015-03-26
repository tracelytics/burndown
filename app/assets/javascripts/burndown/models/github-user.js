/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // GithubUser Model
    // ----------------
    app.GithubUser = Backbone.Model.extend({
        initialize: function(user) {
            var name = user.login ? user.login : '';
            var avatar_url = user.avatar_url ? user.avatar_url : '';
            var gravatar = user.gravatar_id ? user.gravatar_id : '';
            var url = user.html_url ? user.html_url : '';

            this.set('name', name);
            this.set('avatar_url', avatar_url);
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
            var image_url = '';
            var size_param = 's=40';
            if (this.get('avatar_url')) {
                var avatar_url = this.get('avatar_url');
                var div = avatar_url.split('?').length > 0 ? '&' : '?';
                image_url = [avatar_url, div, size_param].join('');
            }
            else if (this.get('gravatar')) {
                image_url = ['http://www.gravatar.com/avatar/', this.get('gravatar'), size_param].join('');
            }

            var rval = ['<img src="' + image_url + '" title="' + this.get('name') + '">'].join('');

            return rval;
        }
    });
})();
