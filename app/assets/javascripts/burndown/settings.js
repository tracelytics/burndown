/*global Backbone, jQuery, _, ENTER_KEY */
var app = app || {};

(function () {

    // Magic underscore settings to allow underscore templates to play
    // nicely with Rails ERB templates!
    //--------------------------------------------------------------------------
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };

})();
