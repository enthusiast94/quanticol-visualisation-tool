/**
 * Created by ManasB on 6/15/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "collections/unique_vehicles",
    "collections/services",
    "views/vehicle_item",
    "views/select_services_modal",
    "swig",
    "text!../../templates/select_vehicles_modal.html",
    "text!../../templates/vehicle_item.html"
], function($, _, Backbone, uniqueVehicleCollection, serviceCollection, VehicleItemView, selectServicesModal, swig, selectVehiclesModalTemplate, vehicleItemTemplate) {
    "use strict";

    var SelectVehiclesView = Backbone.View.extend({
        el: "#select-vehicles-modal-container",
        initialize: function () {
            uniqueVehicleCollection.on("reset", this.addAllVehicles, this);
            selectServicesModal.on("modal.closed", this.refreshVehicles, this);
        },
        events: {
            "click #select-all-vehicles-button": "selectAll"
        },
        render: function() {
            var compiledTemplate = swig.render(selectVehiclesModalTemplate);
            this.$el.html(compiledTemplate);

            this.delegateEvents(this.events);
        },
        addAllVehicles: function() {
            $("#select-vehicles-modal-progress").hide();

            $("#vehicles-container").empty();

            uniqueVehicleCollection.each(this.addVehicle, this);
        },
        addVehicle: function(vehicle) {
            var vehicleItemView = new VehicleItemView({model: vehicle});
            $("#vehicles-container").append(vehicleItemView.render().el);
        },
        refreshVehicles: function () {
            $("#select-vehicles-modal-progress").show();

            var selectedServiceNames = serviceCollection.getSelectedNames();

            uniqueVehicleCollection.fetch({
                data: $.param({service: selectedServiceNames}),
                reset: true
            });

            $("#selected-vehicles-modal-services").text(selectedServiceNames);
        },
        selectAll: function () {
            uniqueVehicleCollection.each(function (vehicle) {
                vehicle.set("isSelected", true);
            });
        },
        reset: function () {
            uniqueVehicleCollection.reset();
        }
    });

    return new SelectVehiclesView();
});