/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // Session Model
    // -------------
    app.Message = Backbone.Model.extend({
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
})();
