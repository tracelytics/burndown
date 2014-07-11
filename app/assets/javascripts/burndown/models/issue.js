/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// Issue Model
	// -----------
    app.Issue = Backbone.Model.extend({
        getClosedTime: function() {
            var closed = this.get('closed_at') || 0;
            var date = new Date(closed);
            return date.getTime() / 1000;
        },

        getCreatedTime: function() {
            var created = this.get('created_at') || 0;
            var date = new Date(created);
            return date.getTime() / 1000;
        },

        getLabels: function() {
            var labels = this.get('labels') || [];
            return _.map(labels, function(label) {
                return label.name;
            });
        },

        getLabelString: function() {
            return _.reduce(this.getLabels(), function(memo, label) {
                return memo + label + ',';
            }, '');
        },

        getWeight: function() {
            var self = this;
            var weight = 1;
            var re = /Weight: (\d+)/;
            var label = _.find(self.getLabels(), function(label) {
                return re.test(label);
            });
            var myArray = re.exec(label);
            if (myArray != null) {
                weight = parseInt(myArray[1], 10);
            }
            return weight;
        },

        createLink: function() {
            var rval = '';

            var assignee = this.get('assignee') || null;
            var creator = this.get('user');
            var title = this.escape('title');
            var url = this.get('html_url');

            var created_at = new Date(this.get('created_at'));
            var month = created_at.getMonth() + 1;
            var issue_created = month + '/' + created_at.getDate() + '/' + created_at.getFullYear();

            var closed_at = this.get('closed_at');
            var work_duration_details = '';
            if (closed_at) {
                var closed_date = new Date(closed_at);
                var month = closed_date.getMonth() + 1;
                var issue_closed = month + '/' + closed_date.getDate() + '/' + closed_date.getFullYear();
                work_duration_details = issue_created + ' - ' + issue_closed;
            }
            else {
                var closed_date = new Date(Date.now());
                work_duration_details = issue_created + ' - ???';
            }

            var work_duration = moment(closed_date).from(created_at, true);

            if (creator && title && url) {
                var creator_user = new app.GithubUser(creator);
                var assigned_user = assignee ? new app.GithubUser(assignee) : null;
                rval = ['<ul>',
                        '<li class="title"><a target="_blank" href="' + url + '" title="' + title + '">',
                        title,
                        '<small>' +
                        'created by ' + creator_user.get('name'),
                        '</small>',
                        '</a></li>',
                        '<li class="whoswho">',
                        creator_user.getIcon(),
                        '<ins>&rArr;</ins>',
                        assigned_user ? assigned_user.getIcon() : '<ins class="annon">?</ins>',
                        '</li>',
                        '<li class="countdown">',
                        '<ins>' + work_duration + '</ins>',
                        '<ins>' + work_duration_details + '</ins>',
                        '</li>',
                        '</ul>'].join('');
            }

            return rval;
        },

        isClosed: function() {
            return this.get('state') === 'closed';
        },

        isOpen: function() {
            return this.get('state') === 'open';
        },

        isPullRequest: function() {
            return this.has('pull_request');
        }
    });
})();
