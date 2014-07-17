/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    // Session Model
    // -------------
    app.Label = Backbone.Model.extend({
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
})();
