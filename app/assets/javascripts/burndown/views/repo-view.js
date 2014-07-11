/*global Backbone, jQuery, _, ENTER_KEY, ESC_KEY */
var app = app || {};

(function ($) {
	'use strict';

    function capitaliseFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

	// Repo View
	// --------------
    app.RepoView = Backbone.View.extend({
        el: '.content',

        events: {
            'click button#fetch': 'getInputText',
            'keypress input[type=text]': 'filterKeypress'
        },

        initialize: function() {
            _.bindAll(this, 'render', 'filterKeypress', 'loadRepoMilestones',
                            'getInputText', 'errorHandler');
            var self = this;

            self.message = new app.Message();

            app.milestones.on('error', self.errorHandler, this);
        },

        render: function() {
            var self = this;
            var state = app.milestones.state;
            var adverseState = (state === 'open') ? 'closed' : 'open';
            var template = _.template($("#tmpl_repo").html(),
                                      {milestones: app.milestones.models,
                                       session: app.session,
                                       message: self.message,
                                       state: state,
                                       stateFormatted: capitaliseFirstLetter(state),
                                       adverseState: adverseState});
            this.$el.html( template );
            return this;
        },

        filterKeypress: function(e) {
            var self = this;

            // If 'enter' key pressed, process the input field.
            if (e.keyCode == 13) self.getInputText();
        },

        loadRepo: function(owner, repo) {
            // Update session model.
            app.session.set('owner', owner);
            app.session.set('repo', repo);
        },

        loadRepoMilestones: function(owner, repo, state) {
            var self = this;

            self.message.clear();
            app.milestones.reset();

            self.loadRepo(owner, repo);

            // Fetch the milestones.
            app.milestones.state = state;
            $.when(app.milestones.all())
                .done(function(response) {
                    console.log('all milestones fetched! ', app.milestones.models.length);
                    self.render();
                });
        },

        getInputText: function() {
            var self = this;

            // Parse the input textbox for the owner and respository.
            var input = $('input', this.el).val();
            var parts = input.split('/');
            var owner = parts[0] || null;
            var repo = parts[1] || null;
            var state = 'open';

            // Persist the owner/repo to the url.
            router.navigate(owner + '/' + repo);

            self.loadRepoMilestones(owner, repo, state);
        },

        errorHandler: function(model, error) {
            var self = this;
            console.log('KA-BOOM!');
            if (!app.session.get('token') || error.status == 403) {
                self.message.setError('Sign into Github before you wreck yourself!');
            } else if (error.status == 404) {
                self.message.setProblem('Repository not found! Do you have access to it?');
            } else {
                console.log('error: ', error);
                var errMsg = "Something went wrong. Please try again!";

                // If there is a responseText from Github, parse it, escape it
                // and set it to the error message.
                if (error.responseText) {
                    var resp = $.parseJSON(error.responseText) || {};
                    errMsg = _.escape(resp.message);
                }

                self.message.setError(errMsg);
            }
            self.render();
        }
    });
})(jQuery);
