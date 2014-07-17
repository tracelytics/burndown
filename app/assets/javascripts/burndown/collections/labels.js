/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // Labels
    // -------------------------
    app.Labels = Backbone.Collection.extend({
        model: app.Label,

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
                        self.add(new app.Label(label));
                    }
                });
            });
        }
    });
})();
