/**
 * Created by ManasB on 6/15/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "bootstrap",
    "collections/services",
    "collections/unique_vehicles",
    "collections/all_vehicles",
    "views/select_services_modal",
    "views/select_vehicles_modal",
    "views/select_time_span_modal",
    "views/snackbar",
    "views/map",
    "views/map_controls",
    "views/legend_disabled_confirmation_modal",
    "swig",
    "text!../../templates/control_panel.html"
], function($, _, Backbone, bootstrap, serviceCollection, uniqueVehicleCollection, allVehicleCollection, selectServicesModal, selectVehiclesModal, selectTimeSpanModal, SnackbarView, mapView, mapControlsView, legendDisabledConfirmationModal, swig, controlPanelTemplate){
    "use strict";

    var ControlPanelView = Backbone.View.extend({
        initialize: function () {
            this.visualizationTypeEnum = {
                REAL: 0,
                SIMULATED: 1
            };

            this.visualizationType = this.visualizationTypeEnum.REAL;

            this.shouldShowHints = true;    // used to display hints only for the first time

            var self = this;

            this.resetSnackbar = new SnackbarView({
                content: "All selections have been successfully reset!",
                duration: 3000
            });

            selectServicesModal.on("modal.closed", function () {
                self.refreshControlPanel.call(self);
                serviceCollection.fetchTimespan();
            });
            selectVehiclesModal.on("modal.closed", this.refreshControlPanel, this);
            selectTimeSpanModal.on("modal.closed", this.refreshControlPanel, this);
            selectTimeSpanModal.on("timespan.updated", this.refreshControlPanel, this);
            uniqueVehicleCollection.on("reset", this.refreshControlPanel, this);
            allVehicleCollection.on("reset", this.onSubmitResults, this);
            allVehicleCollection.on("error", this.onError, this);
            legendDisabledConfirmationModal.on("modal.continued", function () {
                $("#button-control-panel-submit").button("loading");

                self.fetchAllVehicles({} /* empty options*/);
            });

        },
        events: {
            "click .control-panel-trigger": "toggleControlPanel",
            "click #select-services-modal-trigger": "showSelectServicesModal",
            "click #select-vehicles-modal-trigger": "showSelectVehiclesModal",
            "click #select-time-span-modal-trigger": "showSelectTimeSpanModal",
            "click #button-control-panel-reset": function () {
                this.reset(true);
            },
            "click #button-control-panel-submit": "submit",
            "change #toggle-live-mode-checkbox": "refreshControlPanel",
            "click #visualize-real-data-pill": function (event) {
                this.selectVisualizationType(event, this.visualizationTypeEnum.REAL)
            },
            "click #visualize-simulated-data-pill": function (event) {
                this.selectVisualizationType(event, this.visualizationTypeEnum.SIMULATED)
            }
        },
        render: function () {
            var compiledTemplate = swig.render(controlPanelTemplate);
            this.$el.html(compiledTemplate);
            $("#control-panel-container").html(this.el);

            this.$controlPanel = $(".control-panel");
            this.$controlPanelTriggerWrapper = $(".control-panel-trigger-wrapper");
            this.$toggleLiveModeCheckbox = $("#toggle-live-mode-checkbox");
            this.$selectServicesModalTrigger = $("#select-services-modal-trigger");
            this.$selectVehiclesModalTrigger = $("#select-vehicles-modal-trigger");
            this.$selectTimespanModalTrigger = $("#select-time-span-modal-trigger");
            this.$currentlySelectedServicesSelect = $("#currently-selected-services-select");
            this.$currentlySelectedVehiclesSelect = $("#currently-selected-vehicles-select");
            this.$startTime = $("#start-time");
            this.$endTime = $("#end-time");
            this.$simulatedDataFileInput = $("#simulated-file-input");
            this.$submitButton = $("#button-control-panel-submit");

            this.delegateEvents(this.events);

            this.isControlPanelVisible = false;

            this.refreshControlPanel();

            var self = this;
            setTimeout(function () {
                self.toggleControlPanel();
            }, 1000);

            if (this.shouldShowHints) {
                setTimeout(function () {
                    self.$selectServicesModalTrigger.tooltip({
                        title: "Start here",
                        placement: "left",
                        trigger: "manual"
                    }).tooltip("show");
                }, 1500);

                this.shouldShowHints = false;
            }
        },
        toggleControlPanel: function () {
            var controlPanelHeight = this.$controlPanel.height();
            if (this.isControlPanelVisible) {
                this.$controlPanel.animate(
                    {marginTop: -controlPanelHeight},
                    {duration: 300, queue: false}
                );

                this.$controlPanelTriggerWrapper.find(".glyphicon")
                    .removeClass()
                    .addClass("glyphicon glyphicon-chevron-down");

                this.isControlPanelVisible = false;
            } else {
                this.$controlPanel.animate(
                    {marginTop: "0"},
                    {duration: 300, queue: false}
                );

                this.$controlPanelTriggerWrapper.find(".glyphicon")
                    .removeClass()
                    .addClass("glyphicon glyphicon-chevron-up");

                this.isControlPanelVisible = true;
            }
        },
        showSelectServicesModal: function() {
            this.$selectServicesModalTrigger.tooltip("destroy");

            selectServicesModal.setVisible(true);
        },
        showSelectVehiclesModal: function() {
            selectVehiclesModal.setVisible(true);
        },
        refreshControlPanel: function() {
            var self = this;

            // update selected service names
            var selectedServices = serviceCollection.filter(function (service) {
                return service.get("isSelected");
            });
            this.$currentlySelectedServicesSelect.empty();
            if (selectedServices.length == 0) {
                this.$currentlySelectedServicesSelect.append("<option disabled>None</option>")
            } else {
                selectedServices.forEach(function (service) {
                    self.$currentlySelectedServicesSelect.append("<option disabled>" + service.get("name") + " (" + service.get("service_type") + ")</option>");
                });
            }

            // update selected vehicle names
            var selectedVehicleIDs = uniqueVehicleCollection.filter(function (vehicle) {
                return vehicle.get("isSelected");
            });
            this.$currentlySelectedVehiclesSelect.empty();
            if (selectedVehicleIDs.length == 0) {
                this.$currentlySelectedVehiclesSelect.append("<option disabled>None</option>")
            } else {
                selectedVehicleIDs.forEach(function (vehicle) {
                    self.$currentlySelectedVehiclesSelect.append("<option disabled>" + vehicle.get("vehicle_id") + " (Services: " + vehicle.get("services") + ")</option>");
                });
            }

            // update selected time span if live mode is not enabled
            if (this.$toggleLiveModeCheckbox.prop("checked")) {
                this.$selectTimespanModalTrigger.prop("disabled", true);
                this.$startTime.text("(Disabled)");
                this.$endTime.text("(Disabled)");
            } else {
                var timeSpan = selectTimeSpanModal.getSelectedTimeSpan();
                this.$startTime.text(timeSpan.startTime.format('MMMM Do YYYY, h:mm a'));
                this.$endTime.text(timeSpan.endTime.format('MMMM Do YYYY, h:mm a'));
                this.$selectTimespanModalTrigger.prop("disabled", false);
            }

            // enable or disable 'select vehicles' and 'select time span' buttons depending on whether user has
            // selected services/vehicles or not
            if (selectedServices.length == 0) {
                this.$selectVehiclesModalTrigger.prop("disabled", true);
                this.$selectTimespanModalTrigger.prop("disabled", true);
            } else {
                this.$selectVehiclesModalTrigger.prop("disabled", false);
                this.$selectTimespanModalTrigger.prop("disabled", false);
            }
        },
        showSelectTimeSpanModal: function () {
            selectTimeSpanModal.setVisible(true);
        },
        reset: function (shouldShowSnackbar) {
            selectServicesModal.reset();
            selectVehiclesModal.reset();
            selectTimeSpanModal.reset();
            mapControlsView.reset();
            mapControlsView.setVisible(false);

            if (shouldShowSnackbar) this.resetSnackbar.toggle();
        },
        submit: function (event) {
            switch (this.visualizationType) {
                case this.visualizationTypeEnum.REAL:
                    var selectedServices = serviceCollection.getAllSelectedNames();
                    var selectedVehicles = uniqueVehicleCollection.getAllSelectedIDs();
                    var timeSpan = selectTimeSpanModal.getSelectedTimeSpan();

                    if (selectedServices.length == 0) {
                        new SnackbarView({
                            content: "Error: You need to select at least 1 service!",
                            duration: 3000
                        }).toggle();
                    } else if (selectedVehicles.length == 0) {
                        new SnackbarView({
                            content: "Error: You need to select at least 1 vehicle!",
                            duration: 3000
                        }).toggle();
                    } else if (selectedServices.length > Object.keys(mapView.markerColors).length) {
                        legendDisabledConfirmationModal.setVisible(true);
                    } else {
                        $(event.target).button("loading");

                        this.fetchAllVehicles({
                            selectedServices: selectedServices,
                            selectedVehicles: selectedVehicles,
                            timeSpan: timeSpan
                        });
                    }
                    break;

                case this.visualizationTypeEnum.SIMULATED:
                    if (this.$simulatedDataFileInput[0].files.length == 0) {
                        new SnackbarView({
                            content: "Error: You must select a file to be uploaded!",
                            duration: 3000
                        }).toggle();
                    } else {
                        var file = this.$simulatedDataFileInput[0].files[0];

                        if (file.type != "text/plain") {
                            new SnackbarView({
                                content: "Error: Only plain text files can be uploaded!",
                                duration: 3000
                            }).toggle();
                            return;
                        }
                        $(event.target).button("loading");

                        // need to fetch services first since they'll be used for marker color assignment
                        var self = this;
                        serviceCollection.fetch({reset: false, success: function () {
                            self.fetchAllVehicles({file: file});
                        }});
                    }
                    break;

                default:
                    throw new Error("Visualization type can only be: " + Object.keys(this.visualizationTypeEnum));
                    break;
            }
        },
        fetchAllVehicles: function (options) {
            switch (this.visualizationType) {
                case this.visualizationTypeEnum.REAL:
                    var selectedServices = options.selectedServices || serviceCollection.getAllSelectedNames();
                    var selectedVehicles = options.selectedVehicles || uniqueVehicleCollection.getAllSelectedIDs();
                    var timeSpan = options.timeSpan || selectTimeSpanModal.getSelectedTimeSpan();

                    allVehicleCollection.reset(undefined, {silent: true});

                    allVehicleCollection.fetch(this.$toggleLiveModeCheckbox.prop("checked") ? "live" : "nonlive", {
                        selectedServices: selectedServices,
                        selectedVehicles: selectedVehicles,
                        startTime: timeSpan.startTime.unix(),
                        endTime: timeSpan.endTime.unix(),
                        reset: true
                    });
                    break;

                case this.visualizationTypeEnum.SIMULATED:
                    allVehicleCollection.reset(undefined, {silent: true});

                    allVehicleCollection.fetch("simulated", {file: options.file, reset: true});
                    break;

                default:
                    throw new Error("Visualization type can only be: " + Object.keys(this.visualizationTypeEnum));
                    break;
            }
        },
        onSubmitResults: function () {
            this.$submitButton.button("reset");

            if (this.visualizationType == this.visualizationTypeEnum.SIMULATED) {
                // IMPORTANT: Need to select those services that were included in the file uploaded by the
                // user. These selections are then used for marker color assignment.
                var servicesToSelect = _.uniq(allVehicleCollection.pluck("service_name"));
                serviceCollection.forEach(function (service) {
                    if (servicesToSelect.indexOf(service.name) > -1) {
                        service.set("isSelected", true);
                    }
                });
            }

            if (allVehicleCollection.length > 0) {
                this.toggleControlPanel();

                mapControlsView.reset();
                mapControlsView.setupSimulation(this.$toggleLiveModeCheckbox.prop("checked") ? "live" : "nonlive");
                mapControlsView.setVisible(true);

            } else {
                new SnackbarView({
                    content: "Error: No vehicles found for your selection!",
                    duration: 3000
                }).toggle();
            }
        },
        onError: function (errorMessage) {
            this.$submitButton.button("reset");

            new SnackbarView({
                content: "Error: " + errorMessage,
                duration: 3000
            }).toggle();
        },
        selectVisualizationType: function (event, visualizationType) {
            var $target = $(event.target);
            $target.parent().siblings().removeClass("active");
            $target.parent().addClass("active");

            $target.parent().siblings().each(function (index, el) {
                $($(el).find("a").attr("data-container")).hide();
            });

            $($target.attr("data-container")).show();

            this.visualizationType = visualizationType;

            this.reset(false);
        }
    });

    return new ControlPanelView();
});