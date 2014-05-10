$(function() {

    // Magic underscore settings to allow underscore templates to play
    // nicely with Rails ERB templates!
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };


    //--------------------------------------------------------------------------
    // Helper Methods
    //--------------------------------------------------------------------------
    function capitaliseFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }


    //--------------------------------------------------------------------------
    // Models
    //--------------------------------------------------------------------------
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

    var PaginatedCollection = Backbone.Collection.extend({
        model: null,
        comparator: null,
        url: null,
        parse: function(response) {
            return response;
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
        all: function(progressCallback) {
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
    var IssuesBase = PaginatedCollection.extend({
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
        id: null,
        url: function() {
            var self = this;

            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

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
        },
        isOpen: function() {
            return (this.get('state') == 'open');
        }
    });
    var Milestones = PaginatedCollection.extend({
        model: Milestone,
        comparator: function(milestone) {
            return milestone.get('created_at');
        },
        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/milestones',
                       '?access_token=',
                       token].join('');

            // If any parameter properties exist, append then to the URL string.
            if (this.state) {
                url += '&state='+this.state;
            }

            return url;
        },
        parse: function(response) {
            console.log('parsing...');
            return response;
        },
        getByNumber: function(id) {
            var number = parseInt(id, 10);
            return this.findWhere({number: number});
        },
        // Default to 'open'. Can also be set to 'closed'.
        state: 'open'
    });

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

            var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
            rgb = rgb ? { r: parseInt(rgb[1], 16), g: parseInt(rgb[2], 16), b: parseInt(rgb[3], 16) } : null;

            // r+g+b should be less than half of max (3 * 256)
            var isdark = parseFloat(rgb.r) + parseFloat(rgb.g) + parseFloat(rgb.b) < 3 * 256 / 2;

            var fontcolor = isdark ? '#ffffff' : '#262626';

            if (name && color) {
                rval = ['<a href="javascript:void(0);" data-label="' + name + '" title="' + name + '" style="background-color:#' + color + '; color:' + fontcolor + ';" data-beforeicon="&#xe027;">',
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


    //--------------------------------------------------------------------------
    // Views
    //--------------------------------------------------------------------------
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

            milestones.on('error', self.errorHandler, this);
        },
        render: function() {
            var self = this;
            var state = milestones.state;
            var adverseState = (state === 'open') ? 'closed' : 'open';
            var template = _.template($("#tmpl_repo").html(),
                                      {milestones: milestones.models,
                                       session: session,
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
            session.set('owner', owner);
            session.set('repo', repo);
        },
        loadRepoMilestones: function(owner, repo, state) {
            var self = this;

            self.message.clear();
            milestones.reset();

            self.loadRepo(owner, repo);

            // Fetch the milestones.
            milestones.state = state;
            $.when(milestones.all())
                .done(function(response) {
                    console.log('all milestones fetched! ', milestones.models.length);
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
            if (!session.get('token') || error.status == 403) {
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
                            'isMilestoneDueDateSet');
            var self = this;

            self.filter = null;
            self.message = new Message();
            self.milestone = new Milestone();
            self.labels = new Labels();
            self.openIssues = new MilestoneOpenIssues();
            self.closedIssues = new MilestoneClosedIssues();

            // Enable a responsive design by re-rendering the chart if the
            // window resizes.
            $(window).on('resize', this.renderChart);
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
        isMilestoneDueDateSet: function() {
            var self = this;
            return (self.milestone.get('due_on') != null);
        },
        getIdealLine: function(openIssues, closedIssues) {
            var self = this;

            var totalIssueCount = openIssues.getTotalWeight() + closedIssues.getTotalWeight();

            // Add ideal velocity line.
            var start = self.milestone.get('created_at');
            var end = self.milestone.get('due_on') || new Date().toISOString();
            var startDate = new Date(start).getTime() / 1000;
            var endDate = new Date(end).getTime() / 1000;

            return [
                {x: startDate, y: totalIssueCount},
                {x: endDate,   y: 0}
            ];
        },
        getClosedLine: function(openIssues, closedIssues) {
            var self = this;

            var start = self.milestone.get('created_at');
            var startDate = new Date(start).getTime() / 1000;
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

            var start = self.milestone.get('created_at');
            var startDate = new Date(start).getTime() / 1000;
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
        loadMilestone: function(id) {
            var self = this;

            // Initialize view.
            self.milestone = milestones.getByNumber(id);

            // Manually fetch the milestone if it was not found.
            if (self.milestone == null) {
                self.milestone = new Milestone({id: id});
                self.milestone.fetch({async: false});
            }

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
            $.when(self.openIssues.all(), self.closedIssues.all())
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

            // Enable a responsive design by re-rendering the chart if the
            // window resizes.
            $(window).on('resize', this.renderChart);
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
            $.when(self.openIssues.all(self.renderOpenProgress), self.closedIssues.all(self.renderClosedProgress))
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
                    width: self.width,
                    height: self.height,
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


    //--------------------------------------------------------------------------
    // Router
    //--------------------------------------------------------------------------
    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            ':owner/:repo': 'repository',
            ':owner/:repo/summary': 'summary',
            ':owner/:repo/:id': 'milestone',
            ':owner/:repo/milestones': 'repository',
            ':owner/:repo/milestones/:state': 'repository'
        }
    });


    //--------------------------------------------------------------------------
    // Instantiations
    //--------------------------------------------------------------------------
    var session = new Session();
    var milestones = new Milestones();

    var repoView = new RepoView();
    var milestoneView = new MilestoneView();
    var summaryView = new SummaryView();
    var router = new Router();


    //--------------------------------------------------------------------------
    // Route Handlers
    //--------------------------------------------------------------------------
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
        // load owner/repo
        // load milestoneView!
        var state = milestones.state || 'open';
        repoView.loadRepo(owner, repo);
        milestoneView.loadMilestone(id);
    });

    router.on('route:repository', function(owner, repo, state) {
        console.log('Load the repository page!');
        if (!state) {
            state = 'open'
        }
        console.log('state: ', state);
        repoView.loadRepoMilestones(owner, repo, state);
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
