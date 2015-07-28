/**
 * Created by ManasB on 6/16/2015.
 */

define([
    "jquery",
    "underscore",
    "backbone",
    "collections/services",
    "datetimepicker",
    "momentTimezone",
    "swig",
    "text!../../templates/select_time_span_modal.html"
], function($, _, Backbone, serviceCollection, datetimepicker, momentTimezone, swig, selectTimeSpanModalTemplate) {
    "use strict";

    var SelectTimeSpanView = Backbone.View.extend({
        el: "#select-time-span-modal-container",
        initialize: function () {
            serviceCollection.on("timespan.fetched", this.updateTimespan, this);
        },
        render: function () {
            var compiledTempalte = swig.render(selectTimeSpanModalTemplate);
            this.$el.html(compiledTempalte);

            this.$modal = $("#select-time-span-modal");

            this.delegateEvents(this.events);

            this.initDateTimePickers();

            // trigger modal.closed event when modal is closed
            // this event will be used as a cue to update timespan in control panel
            var self = this;
            this.$modal.on("hidden.bs.modal", function () {
                self.trigger("modal.closed");
            });
        },
        setVisible: function (shouldSetVisible) {
            if (shouldSetVisible) {
                this.$modal.modal("show");
            } else {
                this.$modal.modal("hide");
            }
        },
        initDateTimePickers: function() {
            var self = this;

            this.startTimePicker = $("#start-time-picker");
            this.endTimePicker = $("#end-time-picker");

            this.startTimePicker.datetimepicker({locale: "en", format: "MMMM Do YYYY, h:mm a", defaultDate: new Date("January 01, 2015 00:00")});
            this.endTimePicker.datetimepicker({locale: "en", format: "MMMM Do YYYY, h:mm a", defaultDate: momentTimezone().tz("Europe/London")});

            this.startTimePicker.on("dp.change", function (e) {
                self.endTimePicker.data("DateTimePicker").minDate(e.date);
            });
            this.endTimePicker.on("dp.change", function (e) {
                self.startTimePicker.data("DateTimePicker").maxDate(e.date);
            });
        },
        getSelectedTimeSpan: function () {
            return {
                startTime: this.startTimePicker.data("DateTimePicker").date(),
                endTime: this.endTimePicker.data("DateTimePicker").date()
            }
        },
        updateTimespan: function (timespan) {
            if (timespan.startTime == null || timespan.endTime == null) {
                this.reset();
            } else {
                this.startTimePicker.data("DateTimePicker").date(momentTimezone.unix(timespan.startTime).tz("Europe/London"));
                this.endTimePicker.data("DateTimePicker").date(momentTimezone.unix(timespan.endTime).tz("Europe/London"));
            }

            this.trigger("timespan.updated");
        },
        reset: function () {
            this.startTimePicker.data("DateTimePicker").date(this.startTimePicker.data("DateTimePicker").defaultDate());
            this.endTimePicker.data("DateTimePicker").date(this.endTimePicker.data("DateTimePicker").defaultDate());
        }
    });

    return new SelectTimeSpanView();
});