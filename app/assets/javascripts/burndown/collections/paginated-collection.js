/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// Paginated Collection
	// --------------------
    app.PaginatedCollection = Backbone.Collection.extend({
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
})();
