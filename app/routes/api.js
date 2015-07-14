/**
 * Created by ManasB on 6/14/2015.
 */

var express = require('express');
var router = express.Router();
var Service = require("../models/service");
var async = require("async");
var https = require("https");
var VehicleLocation = require("../models/vehicle_location");
var VehicleToServices = require("../models/vehicle_to_services");


router.get("/services", function (req, res, next) {
    Service
        .find({}, function (err, services) {
            if (err) return next(err);

            res.json(services);
        });
});

router.get("/vehicles/:filter", function (req, res, next) {
    var filter = req.params.filter;
    var selectedServices = req.query["service"] || [];
    var selectedVehicles = req.query["vehicle"] || [];
    var startTime = req.query["startTime"] ? req.query["startTime"] : 0;
    var endTime = req.query["endTime"] ? req.query["endTime"] : ((new Date()).getTime() / 1000).toFixed(0);

    switch (filter) {
        case "unique":
            VehicleLocation
                .where("service_name").in(selectedServices)
                .distinct("vehicle_id")
                .exec(function (err, vehicleIDs) {
                    if (err) return next(err);

                    // now that we have the distinct vehicle ids, we will find one vehicle for each of these ids
                    // along with all the services they belong to
                    var uniqueVehicles = [];
                    async.each(
                        vehicleIDs,
                        function (vehicleID, cb) {
                            VehicleToServices.findOne({vehicle_id: vehicleID}, "services", function (err, vehicleToServices) {
                                var uniqueVehicle = {vehicle_id: vehicleID, services: vehicleToServices.services};
                                uniqueVehicles.push(uniqueVehicle);

                                cb();
                            });
                        },
                        function () {
                            res.json(uniqueVehicles);
                        }
                    );
                });
            break;

        case "all":
            VehicleLocation
                .where("service_name").in(selectedServices)
                .where("vehicle_id").in(selectedVehicles)
                .where("last_gps_fix").gte(startTime).lte(endTime)
                .select("vehicle_id service_name destination location last_gps_fix")
                .exec(function (err, vehicles) {
                    if (err) return next(err);
                    console.log(vehicles);
                    res.json(vehicles);
                });
            break;

        case "live":
            var options = {
                host: "tfe-opendata.com",
                path: "/api/v1/vehicle_locations",
                headers: {Authorization: "Token " + "0c627af5849e23b0b030bc7352550884"}
            };

            https.get(options, function (httpResponse) {
                var output = "";

                httpResponse.on("data", function (chunk) {
                    output += chunk;
                });

                httpResponse.on("end", function () {
                    var jsonOutput = JSON.parse(output);

                    var filteredVehicles = [];

                    jsonOutput.vehicles.forEach(function (vehicleLocationJson) {
                        // filter according to selected service names and vehicles
                        if (selectedServices.indexOf(vehicleLocationJson.service_name) > -1
                            && selectedVehicles.indexOf(vehicleLocationJson.vehicle_id) > -1) {

                            // combine lat and lng into a single array, making it consistent with the vehicle
                            // model stored in the database
                            vehicleLocationJson.location = [vehicleLocationJson.longitude, vehicleLocationJson.latitude];
                            delete vehicleLocationJson.latitude;
                            delete vehicleLocationJson.longitude;

                            delete vehicleLocationJson.heading;
                            delete vehicleLocationJson.speed;
                            delete vehicleLocationJson.journey_id;
                            delete vehicleLocationJson.vehicle_type;

                            filteredVehicles.push(vehicleLocationJson);
                        }
                    });

                    console.log(filteredVehicles);
                    res.json(filteredVehicles);
                });
            }).on("error", function (err) {
                console.log(err.statusCode);
                console.log("--------timed out-----------");
            });
            break;

        default:
            return next(new Error("Filter can only be 'unique' or 'all'."));
            break;
    }
});


module.exports = router;