/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // Milestone Model
    // ---------------
    app.Milestone = Backbone.Model.extend({
        id: null,

        url: function() {
            var self = this;

            var token = app.session.get('token');
            var owner = app.session.get('owner');
            var repo = app.session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/milestones/'+self.id,
                       '?access_token=',
                       token].join('');

            return url;
        },

        getNumIssues: function() {
            return this.get('open_issues') + this.get('closed_issues');
        },

        getPercentComplete: function() {
            return ((this.get('closed_issues') / (this.get('open_issues') + this.get('closed_issues'))) * 100).toFixed(1);
        },

        getMilestoneLength: function() {
            var created_at = new Date(this.get('created_at'));
            var due_at = new Date(this.get('due_on'));
            return moment(due_at).from(created_at, true);
        },

        getMilestoneCountdown: function() {
            var start_at = new Date(Date.now());
            var due_at = new Date(this.get('due_on'));
            return moment(due_at).from(start_at, true);
        },

        getCreator: function() {
            var rval = '';
            var creator = this.get('creator');

            if (creator) {
                var user = new app.GithubUser(creator);
                rval = user.getLink();
            }

            return rval;
        },

        getCreatedDateFormatted: function() {
            var date = new Date(this.get('created_at'));
            var dateArray = date.toString().split(' ');
            return dateArray.slice(0, 4).join(' ');
        },

        getDueDateFormatted: function() {
            var date = new Date(this.get('due_on'));
            var dateArray = date.toString().split(' ');
            return dateArray.slice(0, 4).join(' ');
        },

        getEditLink: function() {
            // https://github.com/{owner}/{repo}/issues/milestones/{id}/edit
            var owner = app.session.get('owner');
            var repo = app.session.get('repo');
            var url = ['https://github.com',
                       '/'+owner+'/'+repo,
                       '/issues/milestones/',
                       this.get('number')+'/edit'].join('');
            return url;
        },

        isOpen: function() {
            return (this.get('state') == 'open');
        },

        isPastDueDate: function() {
            var now = new Date();
            var due = this.get('due_on');
            return moment(now).isAfter(due);
        },

        isDueToday: function() {
            var now = new Date();
            var due = this.get('due_on') || 0;
            return moment(now).isSame(due, 'day');
        }
    });
})();
