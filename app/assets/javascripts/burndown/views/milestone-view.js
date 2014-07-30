/*global Backbone, jQuery, _ */
var app = app || {};

(function ($) {
    'use strict';

    // MilestoneView
    // -------------
    var MilestoneView = Backbone.View.extend({
        el: '.content',

        events: {
            'click .labels li a': 'toggleLabelFilter',
            'click a[data-inpage]': 'jumpTo'
        },

        initialize: function() {
            _.bindAll(this, 'render', 'loadMilestone', 'toggleLabelFilter',
                            'renderIssues', 'renderChart', 'getIdealLine',
                            'getClosedLine', 'getCreatedLine',
                            'isMilestoneDueDateSet', 'resetView',
                            'initializeDatePicker', 'onDateSet');
            var self = this;

            self.filter = null;
            self.message = new app.Message();
            self.milestone = new app.Milestone();
            self.labels = new app.Labels();
            self.openIssues = new app.MilestoneOpenIssues();
            self.closedIssues = new app.MilestoneClosedIssues();
            self.startDate = null;

            // Enable a responsive design by re-rendering the chart if the
            // window resizes.
            $(window).on('resize', this.renderChart);
        },

        render: function() {
            var self = this;

            // Render main template.
            var template = _.template($('#tmpl_milestone').html(),
                                      {milestone: self.milestone,
                                       session: app.session,
                                       message: self.message});
            self.$el.html( template );

            // Render the chart.
            self.renderChart();

            // Populate label lists.
            var template = _.template($('#tmpl_labels').html(),
                                      {labels: self.labels.models});
            $('.labels', self.el).html(template);

            // Render issues.
            self.renderIssues();

            self.initializeDatePicker();

            return this;
        },

        onDateSet: function(context) {
            var self = this;

            if (!context.select) {
                console.log('no date selected!', context);
                return;
            }

            self.startDate = new Date(context.select);
            console.log('selected', self.startDate);

            self.renderChart();
        },

        initializeDatePicker: function() {
            var self = this;

            var $picker = $('.datepicker', self.el);

            if ($picker.length) {
                // Initialize date picker.
                $picker.pickadate({
                    format: 'yyyy/mm/dd',
                    onSet: self.onDateSet
                });

                var picker = $picker.pickadate('picker');
                picker.set('select', self.startDate);
            }
        },

        renderIssues: function() {
            var self = this;
            // Initialize issue lists.
            var filter = self.filter;
            var open = [];
            var closed = [];

            // Filter?
            if (filter) {
                open = _.filter(self.openIssues.models, function(issue) {
                    var labels = issue.getLabels();
                    return _.contains(labels, filter);
                });
                closed = _.filter(self.closedIssues.models, function(issue) {
                    var labels = issue.getLabels();
                    return _.contains(labels, filter);
                });
            } else {
                open = self.openIssues.models;
                closed = self.closedIssues.models;
            }

            // Populate issue lists.
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: open});
            $('.open', self.el).html(template);
            $('#open-issues-count', self.el).text('[' + open.length + ']');
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: closed});
            $('.closed', self.el).html(template);
            $('#closed-issues-count', self.el).text('[' + closed.length + ']');
        },

        isMilestoneDueDateSet: function() {
            var self = this;
            return (self.milestone.get('due_on') != null);
        },

        getIdealLine: function(openIssues, closedIssues) {
            var self = this;

            var totalIssueCount = openIssues.getTotalWeight() + closedIssues.getTotalWeight();

            // Add ideal velocity line.
            var end = self.milestone.get('due_on') || new Date().toISOString();
            var startDate = self.startDate.getTime() / 1000;
            var endDate = new Date(end).getTime() / 1000;

            return [
                {x: startDate, y: totalIssueCount},
                {x: endDate,   y: 0}
            ];
        },

        getClosedLine: function(openIssues, closedIssues) {
            var self = this;

            var startDate = self.startDate.getTime() / 1000;
            var closedCount = openIssues.getTotalWeight() + closedIssues.getTotalWeight();

            // Creates a starting point for the closed burndown.
            var start = [
                {x: startDate, y: closedCount}
            ];

            var closed = _.map(closedIssues.models, function(issue) {
                closedCount = closedCount - issue.getWeight();
                return {
                    x: issue.getClosedTime(),
                    y: closedCount
                };
            });
            start = start.concat(closed);

            if (self.milestone.isOpen()) {
                // Add a point for now.
                var now = new Date().getTime() / 1000;
                var end = [
                    {x: now, y: closedCount}
                ];
                start = start.concat(end);
            }

            return start;
        },

        getCreatedLine: function(openIssues, closedIssues) {
            var self = this;

            var startDate = self.startDate.getTime() / 1000;
            var allIssues = openIssues.models.concat(closedIssues.models);
            allIssues = _.sortBy(allIssues, function(issue) { return issue.getCreatedTime(); });

            var openCount = 0;

            var created = _.map(allIssues, function(issue) {
                var createdTime = issue.getCreatedTime();
                openCount = openCount + issue.getWeight();
                return {
                    x: createdTime >= startDate ? createdTime : startDate,
                    y: openCount
                };
            });

            if (self.milestone.isOpen()) {
                // Add a point for now.
                var now = new Date().getTime() / 1000;
                var end = [
                    {x: now, y: openCount}
                ];
                created = created.concat(end);
            }

            return created;
        },

        renderChart: function() {
            var self = this;

            if (self.closedIssues.length > 0) {
                // Clear the chart of any previous elements.
                $('#chart').empty();
                $('#y_axis').empty();
                $('#legend').empty();

                var series = [];

                // Only add the ideal velocity line if the milestone due date
                // is set.
                if (self.isMilestoneDueDateSet()) {
                    var ideal = self.getIdealLine(self.openIssues, self.closedIssues);
                    series.push({
                        data:  ideal,
                        color: '#75ABC5',
                        name:  'Ideal'
                    });
                }

                // Add closed velocity line.
                var closed = self.getClosedLine(self.openIssues, self.closedIssues);
                series.push({
                    data: closed,
                    color: '#30c020',
                    name:  'Closed'
                });

                // Add creation line.
                var created = self.getCreatedLine(self.openIssues, self.closedIssues);
                series.push({
                    data:  created,
                    color: '#F89406',
                    name:  'Created'
                });

                // Build graph!
                var graph = new Rickshaw.Graph({
                    element: document.querySelector("#chart"),
                    width: self.width,
                    height: self.height,
                    renderer: 'line',
                    interpolation: 'basis',
                    series: series
                });
                graph.render();

                var legend = new Rickshaw.Graph.Legend( {
                    graph: graph,
                    element: document.getElementById('legend')

                } );

                var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight( {
                    graph: graph,
                    legend: legend
                } );

                var time = new Rickshaw.Fixtures.Time();
                var days = time.unit('day');

                var xAxis = new Rickshaw.Graph.Axis.Time({
                    graph: graph
                    //timeUnit: days
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
        },

        toggleLabelFilter: function(e) {
            var self = this;
            var $target = $(e.target);
            var $labels = $('.labels', self.el);
            var label = $target.data('label') || null;

            // If the label clicked is already applied, then indicates the
            // user wants to remove the filtered label.
            if (self.filter === label) {
                $target.removeClass('active');
                $labels.removeClass('filtering');

                self.filter = null;
            // Else, apply the label filter!
            } else {
                // Remove the currently active label.
                $('ul li a.active', self.el).removeClass('active');

                $target.addClass('active');
                $labels.addClass('filtering');

                self.filter = label;
            }

            // Render with filter!
            self.renderIssues();

            return false;
        },

        resetView: function() {
            var self = this;

            // Clear any previous messages.
            self.message.clear();

            self.labels.reset();
            self.openIssues.reset();
            self.closedIssues.reset();
        },

        loadMilestone: function(id) {
            var self = this;

            self.resetView();

            // Initialize view.
            self.milestone = app.milestones.getByNumber(id);

            // Manually fetch the milestone if it was not found.
            if (self.milestone == null) {
                self.milestone = new app.Milestone({id: id});
                self.milestone.fetch({async: false});
            }

            self.openIssues.milestoneId = self.milestone.get('number');
            self.closedIssues.milestoneId = self.milestone.get('number');
            console.log('milestone: ', self.milestone);

            self.startDate = self.milestone.getCreatedDate();

            // Set a message if the milestone has no due date.
            if (self.milestone.get('due_on') === null) {
                self.message.setProblem('Milestone has no due date!');
            }

            self.render();

            // When all issues (both closed and open) are fetched, re-render
            // the view.
            $.when(self.openIssues.all(), self.closedIssues.all())
             .done(function(openResp, closedResp) {
                // Fetch labels from issues.
                self.labels.addLabelsFromIssues(self.openIssues.models);
                self.labels.addLabelsFromIssues(self.closedIssues.models);

                // Render!
                self.render();
            });
        },

        jumpTo: function(target) {
            var href = target.currentTarget.hash.substring(1);
            document.getElementById(href).scrollIntoView(true);
            return false;
        }
    });

    app.milestoneView = new MilestoneView();
})(jQuery);
