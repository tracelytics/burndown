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
            var rval = ['<a href="' + this.get('url') + '" title="' + this.get('name') + '">',
                        this.getIcon(),
                        this.get('name'),
                        '</a>'].join('');

            return rval;
        },
        getIcon: function() {
            var rval = ['<img src="http://www.gravatar.com/avatar/',
                        this.get('gravatar'),
                        '?s=40" title="' + this.get('name') + '">'].join('');

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
        createLink: function() {
            var rval = '';

            var assignee = this.get('assignee') || null;
            var creator = this.get('user');
            var title = this.get('title');
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
                var creator_user = new GithubUser(creator);
                var assigned_user = assignee ? new GithubUser(assignee) : null;
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
        parse: function(response) {
            return response;
        },
        getDateSince: function(days) {
            var d = new Date();
            d.setDate(d.getDate()-days);
            return d.toISOString();
        },
        /*
         * parse_link_header()
         *
         * Parse the Github Link HTTP header used for pageination
         * http://developer.github.com/v3/#pagination
         */
        parseLinkHeader: function (header) {
          if (header.length == 0) {
              throw new Error("input must not be of zero length");
          }

          // Split parts by comma
          var parts = header.split(',');
          var links = {};
          // Parse each part into a named link
          _.each(parts, function(p) {
              var section = p.split(';');
              if (section.length != 2) {
                  throw new Error("section could not be split on ';'");
              }
              var url = section[0].replace(/<(.*)>/, '$1').trim();
              var name = section[1].replace(/rel="(.*)"/, '$1').trim();
              links[name] = url;
          });

          return links;
        },
        parseLastPage: function(last) {
          if (last.length == 0) {
              throw new Error("input must not be of zero length");
          }

          var patt = /&page=(\d+)/g;
          var result = patt.exec(last);

          if (result.length != 2) {
              throw new Error("regex pattern match failed");
          }

          return result[1];
        },
        getLastPage: function(header) {
            var self = this;

            // If header doesn't exist, there aren't multiple pages of results,
            // so just return 1.
            if (header == null) {
                return 1;
            }

            var parsed = self.parseLinkHeader(header);
            var last = parsed.last || '';
            return self.parseLastPage(last);
        },
        fetchAll: function(progressCallback) {
            var self = this;

            var deferred = $.Deferred();

            if (progressCallback) {
                deferred.progress(progressCallback);
            }

            var currentPage = 1;
            var lastPage = 1;
            var success = function(issues, response, options) {
                // Only parse the last page on the first pass.
                if (currentPage === 1) {
                    var header = options.xhr.getResponseHeader('Link');
                    lastPage = self.getLastPage(header);
                }
                // Only continue fetching if there are pages remaining.
                if (currentPage < lastPage) {
                    currentPage++;
                    deferred.notify(currentPage / lastPage);
                    self.fetch({
                        data: {page: currentPage},
                        remove: false,
                        success: success
                    });
                } else {
                    console.log('end! total pages:', currentPage);
                    deferred.resolve();
                }
            }

            self.fetch({
                data: {page: currentPage},
                remove: false,
                success: success
            });

            return deferred.promise();
        },
        // URL parameter proprties.
        // http://developer.github.com/v3/issues/#list-issues-for-a-repository
        state: null,
        milestoneId: null,
        since: null,
        direction: null
    });
    var MilestoneOpenIssues = IssuesBase.extend({
        state: 'open'
    });
    var MilestoneClosedIssues = IssuesBase.extend({
        state: 'closed'
    });
    var SummaryOpenIssues = IssuesBase.extend({
        state: 'open',
        direction: 'asc',
        since: function() {
            return this.getDateSince(30);
        }
    });
    var SummaryClosedIssues = IssuesBase.extend({
        state: 'closed',
        direction: 'asc',
        since: function() {
            return this.getDateSince(30);
        }
    });

    var Milestone = Backbone.Model.extend({
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
                var user = new GithubUser(creator);
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
            var owner = session.get('owner');
            var repo = session.get('repo');
            var url = ['https://github.com',
                       '/'+owner+'/'+repo,
                       '/issues/milestones/',
                       this.get('number')+'/edit'].join('');
            return url;
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
        },
        getByNumber: function(id) {
            var number = parseInt(id, 10);
            return this.findWhere({number: number});
        }
    });
    var milestones = new Milestones();

    var Message = Backbone.Model.extend({
        initialize: function() {
            _.bindAll(this, 'setProblem', 'setError');
        },
        setProblem: function(text) {
            var self = this;
            self.set('title', 'Problem');
            self.set('text', text);
        },
        setError: function(text) {
            var self = this;
            self.set('title', 'Error');
            self.set('text', text);
        }
    });

    var Label = Backbone.Model.extend({
        defaults: {
            'name': '',
            'color': ''
        },
        createLink: function() {
            var rval = '';

            var name = this.get('name');
            var color = this.get('color');

            if (name && color) {
                rval = ['<a href="javascript:void(0);" data-label="' + name + '" title="' + name + '" style="background-color:#' + color + ';" data-beforeicon="&#xe027;">',
                        name,
                        '</a>'].join('');
            }

            return rval;
        }
    });
    var Labels = Backbone.Collection.extend({
        model: Label,
        initialize: function() {
            _.bindAll(this, 'isDupe', 'addLabelsFromIssues');
        },
        isDupe: function(name) {
            var self = this;
            return self.any(function(issue) {
                return issue.get('name') === name;
            });
        },
        addLabelsFromIssues: function(issues) {
            var self = this;

            // Iterate through each issue's label array.
            _.each(issues, function(issue) {
                _.each((issue.get('labels') || []), function(label) {
                    // If the label has a name and is not in the collection
                    // yet, add it!
                    if (label.name && !self.isDupe(label.name)) {
                        self.add(new Label(label));
                    }
                });
            });
        }
    });

    // Views
    var RepoView = Backbone.View.extend({
        el: '.content',
        events: {
            'click button#fetch': 'getInputText',
            'keypress input[type=text]': 'filterKeypress'
        },
        initialize: function() {
            _.bindAll(this, 'render', 'filterKeypress', 'loadRepoMilestones',
                            'getInputText', 'errorHandler');
            var self = this;

            self.message = new Message();

            milestones.on('sync', function() {
                self.render();
            });
            milestones.on('error', self.errorHandler, this);
        },
        render: function() {
            var self = this;
            var template = _.template($("#tmpl_repo").html(),
                                      {milestones: milestones.models,
                                       session: session,
                                       message: self.message});
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
            session.set('owner', owner);
            session.set('repo', repo);
        },
        loadRepoMilestones: function(owner, repo) {
            var self = this;

            self.message.clear();
            milestones.reset();

            self.loadRepo(owner, repo);

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
            var self = this;
            console.log('KA-BOOM!');
            if (!session.get('token') || error.status == 403) {
                self.message.setError('Sign into Github before you wreck yourself!');
                self.render();
            } else if (error.status == 404) {
                self.message.setProblem('Repository not found! Do you have access to it?');
                self.render();
            } else {
                console.log('error: ', error);
            }
        }
    });

    var MilestoneView = Backbone.View.extend({
        el: '.content',
        events: {
            'click .labels li a': 'toggleLabelFilter',
            'click a[data-inpage]': 'jumpTo'
        },
        initialize: function() {
            _.bindAll(this, 'render', 'loadMilestone', 'toggleLabelFilter',
                            'renderIssues', 'renderChart');
            var self = this;

            self.filter = null;
            self.message = new Message();
            self.milestone = new Milestone();
            self.labels = new Labels();
            self.openIssues = new MilestoneOpenIssues();
            self.closedIssues = new MilestoneClosedIssues();
        },
        render: function() {
            var self = this;

            // Render main template.
            var template = _.template($('#tmpl_milestone').html(),
                                      {milestone: self.milestone,
                                       session: session,
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

            return this;
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
        loadMilestone: function(id) {
            var self = this;

            // Initialize view.
            self.milestone = milestones.getByNumber(id);
            self.openIssues.milestoneId = self.milestone.get('number');
            self.closedIssues.milestoneId = self.milestone.get('number');
            console.log('milestone: ', self.milestone);

            // Clear any previous messages.
            self.message.clear();

            // Set a message if the milestone has no due date.
            if (self.milestone.get('due_on') === null) {
                self.message.setProblem('Milestone has no due date!');
            }

            self.render();

            // When all issues (both closed and open) are fetched, re-render
            // the view.
            $.when(self.openIssues.fetch(), self.closedIssues.fetch())
             .done(function(openResp, closedResp) {
                // Fetch labels from issues.
                self.labels.reset();
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

    var SummaryView = Backbone.View.extend({
        el: '.content',
        initialize: function() {
            _.bindAll(this, 'render', 'resetView', 'loadRepoIssues',
                            'renderOpenProgress', 'renderClosedProgress',
                            'renderChart');
            var self = this;

            self.loaded = false;
            self.progress = {open: 0, closed: 0};
            // All issue collections
            self.openIssues = new SummaryOpenIssues();
            self.closedIssues = new SummaryClosedIssues();
            // Filtered issue collections
            self.createdIssues = new SummaryOpenIssues();
            self.resolvedIssues = new SummaryClosedIssues();
        },
        render: function() {
            var self = this;

            // Render main template.
            var template = _.template($('#tmpl_summary').html(),
                                      {session: session,
                                       loaded: self.loaded,
                                       progress: self.progress,
                                       created: self.createdIssues.models,
                                       resolved: self.resolvedIssues.models});
            this.$el.html( template );

            // Render the chart.
            self.renderChart();

            // Populate issue lists.
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: self.createdIssues.models});
            $('.open', self.el).html(template);
            var template = _.template($('#tmpl_issues').html(),
                                      {issues: self.resolvedIssues.models});
            $('.closed', self.el).html(template);
        },
        resetView: function() {
            var self = this;

            self.loaded = false;
            self.progress = {open: 0, closed: 0};
            self.openIssues.reset();
            self.closedIssues.reset();
            self.createdIssues.reset();
            self.resolvedIssues.reset();
        },
        loadRepoIssues: function() {
            var self = this;

            self.resetView();

            self.render();

            // When all issues (both closed and open) are fetched, filter them
            // and reset the filtered collections.
            $.when(self.openIssues.fetchAll(self.renderOpenProgress), self.closedIssues.fetchAll(self.renderClosedProgress))
             .done(function(openResp, closedResp) {
                console.log('done!');

                var createdIssues = _.filter(self.openIssues.models, function(issue) {
                    var past = new Date(self.openIssues.since());
                    var d = new Date(issue.get('created_at'));
                    return (d.getTime() > past.getTime());
                });
                var resolvedIssues = _.filter(self.closedIssues.models, function(issue) {
                    var past = new Date(self.closedIssues.since());
                    var d = new Date(issue.get('closed_at'));
                    return (d.getTime() > past.getTime());
                });

                self.loaded = true;
                self.createdIssues.reset(createdIssues);
                self.resolvedIssues.reset(resolvedIssues);

                self.render();
            });
        },
        renderOpenProgress: function(progress) {
            var self = this;
            self.progress.open = (progress * 100).toFixed();
            self.render();
        },
        renderClosedProgress: function(progress) {
            var self = this;
            self.progress.closed = (progress * 100).toFixed();
            self.render();
        },
        renderChart: function() {
            var self = this;

            console.log('render chart!');

            if (self.createdIssues.length > 0 && self.resolvedIssues.length > 0) {

                // Clear the chart of any previous elements.
                $('#chart').empty();
                $('#y_axis').empty();
                $('#legend').empty();

                var count = 1;
                var created = _.map(self.createdIssues.models, function(issue) {
                    return {
                        x: issue.getCreatedTime(),
                        y: count++
                    };
                });

                count = 1;
                var resolved = _.map(self.resolvedIssues.models, function(issue) {
                    return {
                        x: issue.getClosedTime(),
                        y: count++
                    };
                });

                // Build graph!
                var graph = new Rickshaw.Graph({
                    element: document.querySelector("#chart"),
                    width: 900,
                    height: 500,
                    renderer: 'line',
                    stroke: true,
                    interpolation: 'basis',
                    series: [{
                        data:  created,
                        color: '#cc0000',
                        name:  'Created'
                    }, {
                        data:  resolved,
                        color: 'green',
                        name:  'Resolved'
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

    // Router
    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            ':owner/:repo': 'repository',
            ':owner/:repo/summary': 'summary',
            ':owner/:repo/:id': 'milestone'
        }
    });

    // Instantiations.
    var repoView = new RepoView();
    var milestoneView = new MilestoneView();
    var summaryView = new SummaryView();
    var router = new Router();

    router.on('route:home', function() {
        console.log('Load the home page!');
        // unset any previously existing session 'owner' or 'repo' attributes.
        // render repoView!
        session.unset('owner');
        session.unset('repo');
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

    router.on('route:summary', function(owner, repo) {
        console.log('Load the repository summary page!');
        // load token
        // load owner/repo
        // not waiting on any xhr, so safe to load summaryView!
        repoView.loadRepo(owner, repo);
        summaryView.loadRepoIssues();
    });

    // Once the session token finishes loading, start the application!
    session.once('change:token', function(model, value) {
        console.log('token: ', value);

        // Let's get this party started!
        Backbone.history.start();
    });
});
