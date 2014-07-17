/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // IssueBase
    // ---------
    app.IssuesBase = app.PaginatedCollection.extend({
        model: app.Issue,

        comparator: function(issue) {
            return issue.get('closed_at');
        },

        url: function() {
            var token = app.session.get('token');
            var owner = app.session.get('owner');
            var repo = app.session.get('repo');

            // Build initial url string.
            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/issues',
                       '?access_token='+token,
                       ''].join('');

            // If any parameter properties exist, append then to the URL string.
            if (this.state) {
                url += '&state='+this.state;
            }
            if (this.milestoneId) {
                url += '&milestone='+this.milestoneId;
            }
            if (this.since) {
                var _since = this.since();
                url += '&since='+_since;
            }
            if (this.direction) {
                url += '&direction='+this.direction;
            }

            return url;
        },

        getDateSince: function(days) {
            var d = new Date();
            d.setDate(d.getDate()-days);
            return d.toISOString();
        },

        getTotalWeight: function() {
            return _.reduce(this.models, function(memo, issue) {
                return memo + issue.getWeight();
            }, 0);
        },

        days: app.SUMMARY_DEFAULT_DAYS,
        // URL parameter proprties.
        // http://developer.github.com/v3/issues/#list-issues-for-a-repository
        state: null,
        milestoneId: null,
        since: null,
        direction: null
    });

    // MilestoneOpenIssues
    // -------------------
    app.MilestoneOpenIssues = app.IssuesBase.extend({
        state: 'open'
    });

    // MilestoneClosedIssues
    // ---------------------
    app.MilestoneClosedIssues = app.IssuesBase.extend({
        state: 'closed'
    });

    // SummaryIssues
    // -------------
    app.SummaryIssues = app.IssuesBase.extend({
        state: 'all',

        direction: 'asc',

        compareProperty: 'created_at',

        comparator: function(issue) {
            return issue.get(this.compareProperty);
        },

        since: function() {
            return this.getDateSince(this.days);
        }
    });

    // SummaryIssuesCreated
    // --------------------
    app.SummaryIssuesCreated = app.SummaryIssues.extend({
        compareProperty: 'created_at'
    });

    // SummaryIssuesClosed
    // -------------------
    app.SummaryIssuesClosed = app.SummaryIssues.extend({
        compareProperty: 'closed_at'
    });
})();
