/*global Backbone, jQuery, _ */
var app = app || {};

(function ($) {
    'use strict';

    // SummaryView
    // -----------
    var SummaryView = Backbone.View.extend({
        el: '.content',

        initialize: function() {
            _.bindAll(this, 'render', 'resetView', 'loadRepoIssues',
                            'renderProgress', 'renderChart');
            var self = this;

            self.days = app.SUMMARY_DEFAULT_DAYS;
            self.loaded = false;
            self.progress = 0;
            // All issue collections
            self.issues = new app.SummaryIssues();
            // Filtered issue collections
            self.closedIssues = new app.SummaryIssuesClosed();
            self.newIssues = new app.SummaryIssuesCreated();

            // Enable a responsive design by re-rendering the chart if the
            // window resizes.
            $(window).on('resize', this.renderChart);
        },

        render: function() {
            var self = this;

            // Render main template.
            var template = _.template($('#tmpl_summary').html(),
                                      {session: app.session,
                                       loaded: self.loaded,
                                       progress: self.progress,
                                       closed: self.closedIssues.models,
                                       newest: self.newIssues.models,
                                       days: self.days});
            this.$el.html( template );

            // Render the chart.
            self.renderChart();

            // Populate issue lists.
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: self.newIssues.models});
            $('.open', self.el).html(template);
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: self.closedIssues.models});
            $('.closed', self.el).html(template);
        },

        resetView: function() {
            var self = this;

            self.loaded = false;
            self.progress = 0;
            self.issues.reset();

            self.issues.days = self.days;

            self.closedIssues.reset();
            self.newIssues.reset();
        },

        loadRepoIssues: function(days) {
            var self = this;

            self.days = days;

            self.resetView();

            self.render();

            // When all issues (both closed and open) are fetched, filter them
            // and reset the filtered collections.
            $.when(self.issues.all(self.renderProgress))
             .done(function(openResp) {
                console.log('done!');

                _.each(self.issues.models, function(issue) {
                    var past = new Date(self.issues.since());
                    var created = issue.get('created_at');
                    var closed = issue.get('closed_at');

                    // Skip pull requests
                    if (issue.isPullRequest()) {
                        return;
                    }

                    // Find created issues that are still open
                    if (issue.isOpen() && moment(created).isAfter(past)) {
                        self.newIssues.add(issue);
                    }

                    // Find created issues that have been resolved
                    if (issue.isClosed() && moment(closed).isAfter(past)) {
                        self.closedIssues.add(issue);
                    }
                });

                self.loaded = true;

                self.render();
            });
        },

        renderProgress: function(progress) {
            var self = this;
            self.progress = (progress * 100).toFixed();
            self.render();
        },

        renderChart: function() {
            var self = this;

            console.log('render chart!');

            if (self.newIssues.length > 0 && self.closedIssues.length > 0) {

                // Clear the chart of any previous elements.
                $('#chart').empty();
                $('#y_axis').empty();
                $('#legend').empty();

                var count = 1;
                var newest = _.map(self.newIssues.models, function(issue) {
                    return {
                        x: issue.getCreatedTime(),
                        y: count++
                    };
                });

                count = 1;
                var closed = _.map(self.closedIssues.models, function(issue) {
                    return {
                        x: issue.getClosedTime(),
                        y: count++
                    };
                });

                // Build graph!
                var graph = new Rickshaw.Graph({
                    element: document.querySelector("#chart"),
                    width: self.width,
                    height: self.height,
                    renderer: 'line',
                    stroke: true,
                    interpolation: 'basis',
                    series: [{
                        data:  newest,
                        color: '#cc0000',
                        name:  'New'
                    }, {
                        data:  closed,
                        color: 'green',
                        name:  'Closed'
                    }]
                });
                graph.render();

                var legend = new Rickshaw.Graph.Legend( {
                    graph: graph,
                    element: document.getElementById('legend')

                });

                var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight( {
                    graph: graph,
                    legend: legend
                });

                var xAxis = new Rickshaw.Graph.Axis.Time({
                    graph: graph
                });
                xAxis.render();

                var yAxis = new Rickshaw.Graph.Axis.Y({
                    graph:          graph,
                    tickFormat:     Rickshaw.Fixtures.Number.formatKMBT,
                    ticksTreatment: 'glow',
                    orientation:    'left',
                    element:        document.getElementById('y_axis')
                });
                yAxis.render();
            }
        }
    });

    app.summaryView = new SummaryView();
})(jQuery);
