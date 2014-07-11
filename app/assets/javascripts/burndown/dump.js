/*global Backbone, jQuery, _, ENTER_KEY */
var app = app || {};

(function () {

    //--------------------------------------------------------------------------
    // Magic underscore settings to allow underscore templates to play
    // nicely with Rails ERB templates!
    //--------------------------------------------------------------------------
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };


    //--------------------------------------------------------------------------
    // Constants
    //--------------------------------------------------------------------------
    SUMMARY_DEFAULT_DAYS = 30;


    //--------------------------------------------------------------------------
    // Setup XHR Pool
    //--------------------------------------------------------------------------
    app.xhrPool = [];
    app.xhrPool.abortAll = function() {
        $(this).each(function(idx, jqXHR) {
            jqXHR.abort();
        });
        app.xhrPool.length = 0
        console.log('xhrPool cleared.');
    };

    $.ajaxSetup({
        beforeSend: function(jqXHR) {
            app.xhrPool.push(jqXHR);
        },
        complete: function(jqXHR) {
            var index = app.xhrPool.indexOf(jqXHR);
            if (index > -1) {
                app.xhrPool.splice(index, 1);
            }
        }
    });


    //--------------------------------------------------------------------------
    // Helper Methods
    //--------------------------------------------------------------------------
    function capitaliseFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }


    //--------------------------------------------------------------------------
    // AppView
    //--------------------------------------------------------------------------
    app.AppView = Backbone.View.extend({
        initialize: function() {
        }
    });

})();
