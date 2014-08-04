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

        app.repoView.render();
    });

    app.router.on('route:repository', function(owner, repo, state) {
        console.log('Load the repository page!');
        if (!state) {
            state = 'open'
        }
        console.log('state: ', state);
        app.repoView.loadRepoMilestones(owner, repo, state);
    });

    app.router.on('route:milestone', function(owner, repo, id) {
        console.log('Load the milestone page!');
        // load owner/repo
        // load milestoneView!
        var state = app.milestones.state || 'open';
        app.repoView.loadRepo(owner, repo);
        app.milestoneView.loadMilestone(id);
    });

    app.router.on('route:summary', function(owner, repo, days) {
        console.log('Load the repository summary page!');
        // load token
        // load owner/repo
        // not waiting on any xhr, so safe to load summaryView!
        if (!days) {
            days = app.SUMMARY_DEFAULT_DAYS;
        }
        app.repoView.loadRepo(owner, repo);
        app.summaryView.loadRepoIssues(days);
    });

    // Send google analytics pageviews when routes are loaded.
    if (window.ga) {
        Backbone.history.on("route", function() {
            var url = Backbone.history.root + '#' + Backbone.history.getFragment();
            ga('send', 'pageview', url);
        });
    }
})();
