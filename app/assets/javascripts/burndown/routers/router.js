/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// Router
	// ------
    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            ':owner/:repo': 'repository',
            ':owner/:repo/summary': 'summary',
            ':owner/:repo/summary/:days': 'summary',
            ':owner/:repo/:id': 'milestone',
            ':owner/:repo/milestones': 'repository',
            ':owner/:repo/milestones/:state': 'repository'
        },

        execute: function(callback, args) {
            app.xhrPool.abortAll();
        },

        // Route Handlers
        // --------------

        home: function() {
            console.log('home called')
        }

    });

    app.router = new Router();

    // Route Handlers
    //---------------
    app.router.on('route:home', function() {
        console.log('Load the home page!');
        // unset any previously existing session 'owner' or 'repo' attributes.
        // render repoView!
        app.session.unset('owner');
        app.session.unset('repo');

        var repoView = new app.RepoView();
        repoView.render();
    });

    //router.on('route:milestone', function(owner, repo, id) {
    //    console.log('Load the milestone page!');
    //    // load owner/repo
    //    // load milestoneView!
    //    var state = milestones.state || 'open';
    //    repoView.loadRepo(owner, repo);
    //    milestoneView.loadMilestone(id);
    //});

    //router.on('route:repository', function(owner, repo, state) {
    //    console.log('Load the repository page!');
    //    if (!state) {
    //        state = 'open'
    //    }
    //    console.log('state: ', state);
    //    repoView.loadRepoMilestones(owner, repo, state);
    //});

    //router.on('route:summary', function(owner, repo, days) {
    //    console.log('Load the repository summary page!');
    //    // load token
    //    // load owner/repo
    //    // not waiting on any xhr, so safe to load summaryView!
    //    if (!days) {
    //        days = SUMMARY_DEFAULT_DAYS;
    //    }
    //    repoView.loadRepo(owner, repo);
    //    summaryView.loadRepoIssues(days);
    //});

    // Once the session token finishes loading, start the application!
    app.session.once('change:token', function(model, value) {
        console.log('token: ', value);

        // Let's get this party started!
        Backbone.history.start();
    });

})();
