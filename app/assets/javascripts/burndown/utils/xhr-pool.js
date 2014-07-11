/*global Backbone, jQuery, _, ENTER_KEY */
var app = app || {};

(function () {

    // Setup XHR Pool
    //---------------
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

})();
