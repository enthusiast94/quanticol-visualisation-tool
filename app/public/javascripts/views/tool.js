/**
 * Created by ManasB on 6/13/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "swig",
    "collections/services",
    "collections/unique_vehicles",
    "views/select_services_modal",
    "views/select_vehicles_modal",
    "views/select_time_span_modal",
    "views/legend_disabled_confirmation_modal",
    "views/control_panel",
    "views/map",
    "views/map_controls",
    "text!../../templates/tool.html"
], function($, _, Backbone, swig, serviceCollection, uniqueVehicleCollection, selectServicesModalView, selectVehiclesModalView, selectTimeSpanModal, legendDisabledConfirmationModal, controlPanelView, mapView, mapControlsView, toolTemplate) {
    "use strict";

    var ToolView = Backbone.View.extend({
        el: "#content",
        render: function () {
            var compiledTemplate = swig.render(toolTemplate);
            this.$el.html(compiledTemplate);

            // render all sub views
            selectServicesModalView.render();
            selectVehiclesModalView.render();
            selectTimeSpanModal.render();
            legendDisabledConfirmationModal.render();
            controlPanelView.render();
            mapView.render();
            mapControlsView.render();

            // reset all collections
            serviceCollection.reset(undefined, {silent: true});
            uniqueVehicleCollection.reset(undefined, {silent: true});
        }
    });

    return new ToolView();
});