/**
 * Created by ManasB on 6/15/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "models/vehicle"
], function($, _, Backbone, VehicleModel){
    "use strict";

    var VehicleCollection = Backbone.Collection.extend({
        model: VehicleModel,
        url: "/api/vehicles/unique",
        fetch: function (options) {
            var self = this;

            $.get(
                this.url,
                {service: options.selectedServices},
                function (response) {
                    if (response.status == 200) {
                        self.reset(response.vehicles, {silent: !(options.reset)});
                    } else {
                        self.trigger("error", response.error);
                    }
                }
            );
        },
        getAllSelectedIDs: function () {
            var selectedIDs = [];
            var selected = this.filter(function (vehicle) {
                return vehicle.get("isSelected");
            });

            for (var i=0; i<selected.length; i++) {
                selectedIDs.push(selected[i].get("vehicle_id"));
            }

            return selectedIDs;
        },
        getSelectedSearchResultsCount: function () {
            var count = this.countBy(function (vehicle) {
                return vehicle.get("isSelected") && vehicle.get("isMatchingSearchTerm");
            }).true;

            return count || 0;
        },
        search: function (term) {
            term = term.trim().toLowerCase();

            var doServicesMatch = function (vehicle, term) {
                var output = false;
                vehicle.get("services").forEach(function (serviceName) {
                    output = output || (serviceName.toLowerCase().indexOf(term) == 0);
                });

                return output;
            };

            this.each(function (vehicle) {
                if (term.length == 0) {
                    vehicle.set("isMatchingSearchTerm", true);
                } else {
                    if (vehicle.get("vehicle_id").toLowerCase().indexOf(term) == 0 || doServicesMatch(vehicle, term)) {
                        vehicle.set("isMatchingSearchTerm", true);
                    } else {
                        vehicle.set("isMatchingSearchTerm", false);
                    }
                }
            });

            this.trigger("reset");
        },
        getSearchResultsCount: function () {
            var count = this.countBy(function (vehicle) {
                return vehicle.get("isMatchingSearchTerm");
            }).true;

            return count || 0;
        }
    });

    return new VehicleCollection();
});