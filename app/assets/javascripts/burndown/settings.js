/*global Backbone, jQuery, _ */
var app = app || {};

(function () {
    'use strict';

    // Settings
    //---------
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };
})();
