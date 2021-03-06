/**
 * Created by ManasB on 6/17/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "collections/unique_vehicles",
    "collections/all_vehicles",
    "collections/services",
    "momentTimezone",
    "views/snackbar",
    "views/map",
    "views/configure_controls_modal",
    "swig",
    "text!../../templates/map_controls.html",
    "text!../../templates/map_controls_legend.html"
], function($, _, Backbone, uniqueVehicleCollection, allVehicleCollection, serviceCollection, momentTimezone, SnackbarView, mapView, configureControlsModal, swig, mapControlsTemplate, mapControlsLegendTemplate) {
    "use strict";

    var MapControlsView = Backbone.View.extend({
        initialize: function () {
            this.isSimulating = false;
            this.arePathPolylinesVisible = false;
            this.areRoutePolylinesVisible = true;
            this.stepSizes = { // all are in seconds
                p: 30,
                f: 60,
                ff: 60*5,
                b: -60,
                fb: -60*5
            };
            this.interpolationAnimationDuration = 500; // ms

            this.timerRefreshIntervalID = null;
            this.liveFetchRefreshIntervalID = null;

            this.timerRefreshInterval = 300; // ms
            this.liveFetchRefreshInterval = 20000; // ms

            this.shouldShowHints = true;    // used to display hints only for the first time

            // update step sizes whenever user successfully configures step sizes
            var self = this;
            configureControlsModal.on("modal.saved.changes", function (newStepSizes) {
                self.stepSizes = newStepSizes;
            });
        },
        render: function () {
            this.$mapControls = $("#map-controls-container");
            var compiledTempalte = swig.render(mapControlsTemplate,
                {locals: {
                    arePathPolylinesVisible: this.arePathPolylinesVisible,
                    areRoutePolylinesVisible: this.areRoutePolylinesVisible,
                    interpolationAnimationDuration: this.interpolationAnimationDuration,
                    refreshInterval: this.timerRefreshInterval
                }});
            this.$el.html(compiledTempalte);
            this.$mapControls.html(this.el);

            this.delegateEvents(this.events);

            this.setVisible(false);
            this.isSimulationControlsPanelVisible = false;

            // close previously running simulation
            if (this.isSimulating) {
                this.toggleSimulation();
            }

            this.simulationControlsTrigger = $("#simulation-controls-trigger");
            this.$currentTimeInput = $("#map-controls-current-time");
            this.$playButton = $("#play-pause-button");
            this.$forwardButton = $("#forward-button");
            this.$fastForwardButton = $("#fast-forward-button");
            this.$backwardButton = $("#backward-button");
            this.$fastBackwardButton = $("#fast-backward-button");
            this.$legend = $("#legend");
            this.$simulationCompletionContainer = $("#simulation-completion-container");
            this.$simulationCompletionRange = $("#simulation-completion-range");
            this.$simulationCompletionOutput = $("#simulation-completion-output");

            // render configure controls modal along with the default step sizes
            configureControlsModal.render(this.stepSizes);

        },
        events: {
            "click #simulation-controls-trigger": "minimizeMaximize",
            "click #play-pause-button": "toggleSimulation",
            "change #show-path-trace-checkbox": "togglePathPolylines",
            "change #show-routes-checkbox": "delegateToggleRoutePolylines",
            "click #forward-button": function() {this.skipSimulation("f")},
            "click #fast-forward-button": function() {this.skipSimulation("ff")},
            "click #backward-button": function() {this.skipSimulation("b")},
            "click #fast-backward-button": function() {this.skipSimulation("fb")},
            "click #configure-controls-link": "showConfigureControlsModal",
            "input #interpolation-animation-duration-input": "updateInterpolationAnimationDuration",
            "input #refresh-interval-input": "updateTimerRefreshInterval",
            "input #simulation-completion-range": "onSimulationCompletionRangeSlide"
        },
        /**
         * shouldMinimize is only used if shouldSetVisible is false. It is basically used to minimize simulation
         * controls panel instead of completely hiding it.
         */
        setVisible: function (shouldSetVisible, shouldMinimize) {
            if (shouldSetVisible) {
                this.$mapControls.animate({
                    marginBottom: "0"
                }, 300);

                var self = this;

                if (this.shouldShowHints) {
                    setTimeout(function () {
                        self.$playButton.tooltip({
                            title: "Click here to start the simulation",
                            placement: "bottom",
                            trigger: "manual"
                        }).tooltip("show");
                    }, 1000);
                }

                this.isSimulationControlsPanelVisible = true;
            } else {
                var height = this.$mapControls.height();

                this.$mapControls.animate({
                    marginBottom: !shouldMinimize ? -height - 100: -height - 46
                }, 300);

                this.isSimulationControlsPanelVisible = false;
            }
        },
        minimizeMaximize: function () {
            if (this.isSimulationControlsPanelVisible) {
                this.simulationControlsTrigger.find(".glyphicon")
                    .removeClass()
                    .addClass("glyphicon glyphicon-chevron-up");

                this.setVisible(false, true);
            } else {
                this.simulationControlsTrigger.find(".glyphicon")
                    .removeClass()
                    .addClass("glyphicon glyphicon-chevron-down");

                this.setVisible(true);
            }
        },
        reset: function () {
            // close previously running simulation
            if (this.isSimulating) {
                this.toggleSimulation();
            }

            mapView.reset();
        },
        setupSimulation: function (mode) {
            this.mode = mode;

            switch (this.mode) {
                case "live":
                    this.timerRefreshInterval = 1000;
                    this.$simulationCompletionContainer.hide(); // completion slider not needed in live mode
                    break;
                case "nonlive":
                    this.timerRefreshInterval = 300;
                    this.$simulationCompletionContainer.show();
                    break;
                default:
                    throw new Error("mode can only be 'live' or 'nonlive'");
            }

            // update current time with start time of simulation
            this.timeSpan = allVehicleCollection.getTimeSpan();
            this.currentTime = this.timeSpan.startTime;
            this.updateTimer();

            this.updateSimulationCompletion();

            mapView.assignMarkerColors();
            this.updateLegend();
            mapView.updateMarkers(this.currentTime, this.arePathPolylinesVisible, this.interpolationAnimationDuration);
            this.updateControlsAndOptionsVisiblity();

            if (this.areRoutePolylinesVisible) {
                mapView.toggleRoutePolylines("show");
            } else {
                mapView.toggleRoutePolylines("hide");
            }
        },
        updateTimer: function () {
            this.$currentTimeInput.val(momentTimezone.unix(this.currentTime).tz("Europe/London").locale("en").format("MMMM Do YYYY, h:mm:ss a"));
        },
        toggleSimulation: function () {
            this.$playButton.tooltip("destroy");

            if (this.shouldShowHints) {
                new SnackbarView({
                    content: "Hint: Click on a marker to view detailed information about the vehicle",
                    duration: 5000
                }).toggle();

                this.shouldShowHints = false;
            }

            if (this.isSimulating) {
                this.isSimulating = false;

                this.$playButton.children().removeClass().addClass("glyphicon glyphicon-play");

                clearInterval(this.timerRefreshIntervalID);

                if (this.mode == "live") {
                    clearInterval(this.liveFetchRefreshIntervalID);
                }
            } else {
                this.isSimulating = true;

                this.$playButton.children().removeClass().addClass("glyphicon glyphicon-pause");

                var self = this;
                this.timerRefreshIntervalID = setInterval(function() {

                    if (self.mode == "live") {
                        // update time span since new data might have been added
                        self.timeSpan = allVehicleCollection.getTimeSpan();

                        self.currentTime = momentTimezone().unix();
                    } else {
                        self.currentTime += self.stepSizes.p;

                        if (self.currentTime > self.timeSpan.endTime) {
                            self.currentTime = self.timeSpan.endTime;
                            self.toggleSimulation();

                            new SnackbarView({
                                content: "Simulation has ended!",
                                duration: 3000
                            }).toggle();
                        }
                    }

                    self.updateTimer();

                    self.updateSimulationCompletion();

                    mapView.updateMarkers(self.currentTime, self.arePathPolylinesVisible, self.interpolationAnimationDuration);
                }, this.timerRefreshInterval);

                if (this.mode == "live") {
                    this.liveFetchRefreshIntervalID = setInterval(function () {
                        allVehicleCollection.fetch("live", {
                            selectedServices: serviceCollection.getAllSelectedNames(),
                            selectedVehicles: uniqueVehicleCollection.getAllSelectedIDs(),
                            startTime: self.timeSpan.startTime,
                            endTime: self.timeSpan.endTime,
                            reset: false
                        });
                    }, this.liveFetchRefreshInterval);
                }
            }

            this.updateControlsAndOptionsVisiblity();
        },
        /**
         * Updates the legend with all service names mapped to their colors. This method can only be called
         * AFTER the color assignment has been done, i.e. mapView's assignMarkerColors() must be called first.
         * If the number of selected services is greater than the number of available colors, then the legend
         * is not shown/updated.
         */
        updateLegend: function () {
            var compiledTemplate = null;

            var colorsLength = Object.keys(mapView.markerColors).length;
            if (serviceCollection.getAllSelectedNames().length > colorsLength) {
                compiledTemplate = swig.render(
                    "(Disabled because more than {{ colorsLength }} services were selected)",
                    {locals: {colorsLength: colorsLength}}
                );
            } else {
                compiledTemplate = swig.render(mapControlsLegendTemplate, {locals: {services: mapView.markerColorAssignment}});
            }

            this.$legend.html(compiledTemplate);
        },
        togglePathPolylines: function () {
            this.arePathPolylinesVisible = !this.arePathPolylinesVisible;

            mapView.updateMarkers(this.currentTime, this.arePathPolylinesVisible, this.interpolationAnimationDuration);
        },
        delegateToggleRoutePolylines: function () {
            if (this.areRoutePolylinesVisible) {
                mapView.toggleRoutePolylines("hide");
                this.areRoutePolylinesVisible = false;
            } else {
                mapView.toggleRoutePolylines("show");
                this.areRoutePolylinesVisible = true;
            }
        },
        skipSimulation: function(action) {
            if (Object.keys(this.stepSizes).indexOf(action) == -1) {
                throw new Error("Action can only be 'f', 'ff', 'b' or 'fb'");
            }

            this.currentTime += this.stepSizes[action];

            if (this.currentTime > this.timeSpan.endTime) {
                this.currentTime = this.timeSpan.endTime;
            } else if (this.currentTime < this.timeSpan.startTime) {
                this.currentTime = this.timeSpan.startTime;
            }

            this.updateTimer();
            this.updateSimulationCompletion();
            this.updateControlsAndOptionsVisiblity();
            mapView.updateMarkers(this.currentTime, this.arePathPolylinesVisible, this.interpolationAnimationDuration);
        },
        updateControlsAndOptionsVisiblity: function () {
            if (this.isSimulating) {
                this.$playButton.siblings().attr("disabled", "disabled");

                this.$simulationCompletionRange.attr("disabled", "disabled");

                $("#refresh-interval-input").attr("disabled", "disabled");
            } else {
                if (this.currentTime == this.timeSpan.endTime) {
                    this.$forwardButton.attr("disabled", "disabled");
                    this.$fastForwardButton.attr("disabled", "disabled");
                } else {
                    this.$forwardButton.removeAttr("disabled");
                    this.$fastForwardButton.removeAttr("disabled");
                }

                if (this.currentTime == this.timeSpan.startTime) {
                    this.$backwardButton.attr("disabled", "disabled");
                    this.$fastBackwardButton.attr("disabled", "disabled");
                } else {
                    this.$backwardButton.removeAttr("disabled");
                    this.$fastBackwardButton.removeAttr("disabled");
                }

                this.$simulationCompletionRange.removeAttr("disabled");

                $("#refresh-interval-input").removeAttr("disabled");
            }
        },
        showConfigureControlsModal: function () {
            configureControlsModal.render(this.stepSizes);
            $("#configure-controls-modal").modal("show");
        },
        updateInterpolationAnimationDuration: function(event) {
            var newDuration = $(event.target).val().trim();
            if (newDuration.length > 0) {
                newDuration = parseInt(newDuration);
                if (!isNaN(newDuration)) {
                    if (newDuration > 0) {
                        this.interpolationAnimationDuration = newDuration;
                    }
                }
            }
        },
        updateTimerRefreshInterval: function (event) {
            var newInterval = $(event.target).val().trim();
            if (newInterval.length > 0) {
                newInterval = parseInt(newInterval);
                if (!isNaN(newInterval)) {
                    if (newInterval > 0) {
                        this.timerRefreshInterval = newInterval;
                    }
                }
            }
        },
        updateSimulationCompletion: function () {
            var completion = Math.round(
                (this.currentTime - this.timeSpan.startTime) / (this.timeSpan.endTime - this.timeSpan.startTime) * 100
            );

            this.$simulationCompletionOutput.text(completion + "%");
            this.$simulationCompletionRange.val(completion);
        },
        onSimulationCompletionRangeSlide: function () {
            this.currentTime = Math.round(
                ((this.$simulationCompletionRange.val() / 100) * (this.timeSpan.endTime - this.timeSpan.startTime))
                + this.timeSpan.startTime
            );

            this.updateSimulationCompletion();
            this.updateTimer();
            this.updateControlsAndOptionsVisiblity();
            mapView.updateMarkers(this.currentTime, this.arePathPolylinesVisible, this.interpolationAnimationDuration);
        }
    });

    return new MapControlsView();
});