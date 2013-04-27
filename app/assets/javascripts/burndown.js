$(function() {

    // Magic underscore settings to allow underscore templates to play
    // nicely with Rails ERB templates!
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };

    // Models
    var Session = Backbone.Model.extend({
        defaults: {
            'owner': '',
            'repo': ''
        },
        initialize: function() {
            var self = this;
            _.bindAll(this, 'getURL');
            $.getJSON('/sessions/get', function(response) {
                var data = response.data;
                var token = null;
                if (response.status == "ok" && data.token) {
                    console.log('session created!');
                    token = data.token;
                }
                self.set('token', token);
            });
        },
        getURL: function() {
            var self = this;
            return self.get('owner') + '/' + self.get('repo');
        }
    });
    var session = new Session();

    var GithubUser = Backbone.Model.extend({
        initialize: function(user) {
            var name = user.login ? user.login : '';
            var gravatar = user.gravatar_id ? user.gravatar_id : '';
            var url = user.html_url ? user.html_url : '';

            this.set('name', name);
            this.set('gravatar', gravatar);
            this.set('url', url);
        },
        getLink: function() {
            var rval = ['<a href="' + this.get('url') + '">',
                        this.getIcon(),
                        this.get('name'),
                        '</a>'].join('');

            return rval;
        },
        getIcon: function() {
            var rval = ['<img src="http://www.gravatar.com/avatar/',
                        this.get('gravatar'),
                        '?s=20">'].join('');

            return rval;
        }
    });

    var Issue = Backbone.Model.extend({
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
        createLink: function() {
            var rval = '';

            var creator = this.get('user');
            var title = this.get('title');
            var url = this.get('html_url');

            if (creator && title && url) {
                var user = new GithubUser(creator);
                rval = ['<a href="' + url + '">',
                        user.getIcon(),
                        ' ',
                        title,
                        '</a>'].join('');
            }

            return rval;
        }
    });
    var IssuesBase = Backbone.Collection.extend({
        model: Issue,
        comparator: function(issue) {
            return issue.get('closed_at');
        },
        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/issues',
                       '?access_token='+token,
                       '&state='+this.state,
                       '&milestone='+this.milestoneId,
                       ''].join('');
            return url;
        },
        parse: function(response) {
            return response;
        },
        state: 'open',
        milestoneId: 0
    });
    var OpenIssues = IssuesBase.extend({
        state: 'open'
    });
    var ClosedIssues = IssuesBase.extend({
        state: 'closed'
    });

    var Milestone = Backbone.Model.extend({
        getNumIssues: function() {
            return this.get('open_issues') + this.get('closed_issues');
        },
        getCreator: function() {
            var rval = '';
            var creator = this.get('creator');

            if (creator) {
                var user = new GithubUser(creator);
                rval = user.getLink();
            }

            return rval;
        }
    });
    var Milestones = Backbone.Collection.extend({
        model: Milestone,
        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/milestones',
                       '?access_token=',
                       token].join('');
            return url;
        },
        parse: function(response) {
            console.log('parsing...');
            return response;
        }
    });
    var milestones = new Milestones();

    // Views
    var RepoView = Backbone.View.extend({
        el: '.le-hook',
        events: {
            'click button#fetch': 'getInputText'
        },
        initialize: function() {
            _.bindAll(this, 'render', 'loadRepoMilestones', 'getInputText');
            var self = this;

            milestones.on('sync', self.render);
            milestones.on('error', self.errorHandler, this);
        },
        render: function() {
            var template = _.template($("#tmpl_repo").html(),
                                      {milestones: milestones.models,
                                       session: session});
            this.$el.html( template );
            return this;
        },
        loadRepoMilestones: function(owner, repo) {
            var self = this;

            // Update session model.
            session.set('owner', owner);
            session.set('repo', repo);

            // Fetch the milestones.
            milestones.fetch();
        },
        getInputText: function() {
            var self = this;

            // Parse the input textbox for the owner and respository.
            var input = $('input', this.el).val();
            var parts = input.split('/');
            var owner = parts[0] || null;
            var repo = parts[1] || null;

            // Persist the owner/repo to the url.
            router.navigate(owner + '/' + repo);

            self.loadRepoMilestones(owner, repo);
        },
        errorHandler: function(model, error) {
            console.log('KA-BOOM!');
            if (!session.get('token')) {
                console.log('Token not set! Login you nerd...');
            } else {
                console.log('error: ', error);
            }
        }
    });

    var MilestoneView = Backbone.View.extend({
        el: '.le-hook',
        initialize: function() {
            _.bindAll(this, 'render', 'loadMilestone', 'renderChart');
            var self = this;

            self.milestone = new Milestone();
            self.openIssues = new OpenIssues();
            self.closedIssues = new ClosedIssues();

            // dependencies
            self.openIssues.on('sync', self.renderChart);
            self.closedIssues.on('sync', self.renderChart);
        },
        render: function(tmpl, data) {
            var template = _.template($(tmpl).html(), data);
            this.$el.html( template );
            return this;
        },
        renderChart: function() {
            var self = this;

            if (self.openIssues.length > 0 && self.closedIssues.length > 0) {
                // Clear the chart of any previous elements.
                $('#chart').empty();
                $('#y_axis').empty();
                $('#legend').empty();

                var totalIssueCount = self.openIssues.length + self.closedIssues.length;

                // Add ideal velocity line.
                var start = self.milestone.get('created_at');
                var end = self.milestone.get('due_on') || new Date().toISOString();
                var startDate = new Date(start).getTime() / 1000;
                var endDate = new Date(end).getTime() / 1000;

                var ideal = [
                    {x: startDate, y: totalIssueCount},
                    {x: endDate,   y: 0}
                ];

                // Add actual velocity line.
                var closedCount = totalIssueCount;

                var actual = _.map(self.closedIssues.models, function(issue) {
                    return {
                        x: issue.getClosedTime(),
                        y: --closedCount
                    };
                });

                // Add creation line.
                var allIssues = self.openIssues.models.concat(self.closedIssues.models);
                allIssues = _.sortBy(allIssues, function(issue) { return issue.getCreatedTime(); });

                var openCount = 0;

                var created = _.map(allIssues, function(issue) {
                    var createdTime = issue.getCreatedTime();
                    return {
                        x: createdTime >= startDate ? createdTime : startDate,
                        y: ++openCount
                    };
                });

                console.log('issue: ', allIssues[0]);

                // Build graph!
                var graph = new Rickshaw.Graph({
                    element: document.querySelector("#chart"),
                    width: 900,
                    height: 500,
                    renderer: 'line',
                    interpolation: 'basis',
                    series: [{
                        data:  ideal,
                        color: '#75ABC5',
                        name:  'Ideal'
                    }, {
                        data:  actual,
                        color: '#F89406',
                        name:  'Actual'
                    }, {
                        data:  created,
                        color: '#30c020',
                        name:  'Created'
                    }]
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
        loadMilestone: function(id) {
            var self = this;

            // Render the loading template.
            self.render("#tmpl_loading", {});

            self.milestone = milestones.at(id);
            console.log('milestone: ', self.milestone);

            self.openIssues.milestoneId = self.milestone.get('number');
            self.closedIssues.milestoneId = self.milestone.get('number');

            // Render the milestone template.
            self.render('#tmpl_milestone', {milestone: self.milestone,
                                            session: session});

            self.openIssues.fetch({
                success: function(issues) {
                    data = {
                        issues: issues.models
                    };
                    var template = _.template($('#tmpl_issues').html(), data);
                    $('.open', self.el).html(template);
                }
            });
            self.closedIssues.fetch({
                success: function(issues) {
                    data = {
                        issues: issues.models
                    };
                    var template = _.template($('#tmpl_issues').html(), data);
                    $('.closed', self.el).html(template);
                }
            });
        }
    });

    // Router
    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            ':owner/:repo': 'repository',
            ':owner/:repo/:id': 'milestone'
        }
    });

    // Instantiations.
    var repoView = new RepoView();
    var milestoneView = new MilestoneView();
    var router = new Router();

    router.on('route:home', function() {
        console.log('Load the home page!');
        repoView.render();
    });

    router.on('route:milestone', function(owner, repo, id) {
        console.log('Load the milestone page!');
        // load token
        // load owner/repo
        // load milestones
        // renders repoView
        // safe: load milestoneView!
        repoView.loadRepoMilestones(owner, repo);
        milestones.once('sync', function() {
            milestoneView.loadMilestone(id);
        });
    });

    router.on('route:repository', function(owner, repo) {
        console.log('Load the repository page!');
        repoView.loadRepoMilestones(owner, repo);
    });

    // Once the session token finishes loading, start the application!
    session.once('change:token', function(model, value) {
        console.log('token: ', value);

        // Let's get this party started!
        Backbone.history.start();
    });
});
