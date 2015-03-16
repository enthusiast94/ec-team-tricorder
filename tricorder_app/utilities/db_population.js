/**
 * Created by Manas on 23-02-2015.
 */

var https = require('https');
var mongoose = require('mongoose');
var async = require('async');
var moment = require('moment');
var dbConfig = require("./db");

// models
var Stop = require('../models/stop').Stop;
var Service = require("../models/service").Service;
var Timetable = require("../models/timetable").Timetable;
var ServiceStatus = require("../models/service_status").ServiceStatus;
var LiveLocation = require("../models/live_location").LiveLocation;
var VehicleStat = require("../models/vehicle_stats").VehicleStat;
var StopStat = require("../models/stop_stats").StopStat;

var API_BASE_URL = "https://tfe-opendata.com/api/v1";

function populateStops(callbackA) {
    console.log("Populating Stops...");

    Stop.remove(function (err) {
        if (!err) {
            https.get(API_BASE_URL + "/stops", function(res) {
                var body = "";

                res.on('data', function (chunk) {
                    body += chunk;
                });

                res.on('end', function() {
                    var json = JSON.parse(body);
                    async.each(
                        json.stops,
                        function (stopJson, callbackB) {
                            // use mongodb coordinates so that 'near' queries can be made
                            var coordinates = [];
                            coordinates.push(stopJson.longitude);
                            coordinates.push(stopJson.latitude);
                            stopJson.coordinates = coordinates;
                            delete stopJson.latitude;
                            delete stopJson.longitude;

                            var stop = new Stop(stopJson);
                            stop.save(function(err) {
                                if (!err) {
                                    callbackB();
                                }
                            });
                        },
                        function (err) {
                            if (!err) {
                                console.log("DONE\n");
                                callbackA(err, null);
                            }
                        }
                    );
                });
            });
        }
    });

}

function populateServices(callbackA) {
    console.log("Populating Services...");

    Service.remove(function (err) {
        if (!err) {
            https.get(API_BASE_URL + "/services", function(res) {
                var body = "";
                res.on('data', function(chunk){
                    body += chunk;
                });

                res.on('end', function() {
                    var json = JSON.parse(body);
                    async.each(
                        json.services,
                        function (serviceJson, callbackB) {
                            var service = new Service(serviceJson);
                            service.save(function(err) {
                                if(!err){
                                    callbackB();
                                }
                            });
                        },
                        function (err) {
                            if (!err) {
                                console.log("DONE\n");
                                callbackA(err, null);
                            }
                        }
                    );
                });
            });
        }
    });
}

function populateTimetables(callbackA) {
    console.log("Populating Timetables...");

    Timetable.remove(function (err) {
        if (!err) {
            Stop.find({}, 'stop_id', function(err, stops) {
                async.each(
                    stops,
                    function (stop, callbackB) {
                        https.get(API_BASE_URL + "/timetables/" + stop.stop_id, function(res) {
                            var body = '';
                            res.on('data', function(chunk){
                                body += chunk;
                            });

                            res.on('end', function() {
                                var json = JSON.parse(body);

                                async.each(
                                    json["departures"],
                                    function (departure, callbackC) {
                                        var timetableDoc = {
                                            stop_id: json["stop_id"],
                                            stop_name: json["stop_name"],
                                            service_name: departure["service_name"],
                                            time: departure["time"],
                                            timestamp: moment(departure["time"], "HH:mm").unix(),
                                            destination: departure["destination"],
                                            day: departure["day"]
                                        };

                                        var timetable = new Timetable(timetableDoc);
                                        timetable.save(function(err) {
                                            if(!err) {
                                                callbackC();
                                            }
                                        });
                                    },
                                    function (err) {
                                        callbackB(err, null);
                                    }
                                );
                            });
                        });
                    },
                    function (err) {
                        if (!err) {
                            console.log("DONE\n");
                            callbackA(err, null);
                        }
                    }
                );
            });
        }
    });
}

function populateServiceStatuses(callbackA) {
    console.log("Populating Service Statuses...");

    ServiceStatus.remove(function (err) {
        if (!err) {
            https.get(API_BASE_URL + "/status", function(res){
                var body = '';
                res.on('data', function(chunk){
                    body += chunk;
                });

                res.on('end', function() {
                    var json = JSON.parse(body);
                    async.each(
                        json.disruptions,
                        function (disruptionJson, callbackB) {
                            var status = new ServiceStatus(disruptionJson);
                            status.save(function(err) {
                                if(!err){
                                    callbackB();
                                }
                            });
                        },
                        function (err) {
                            if (!err) {
                                console.log("DONE\n");
                                callbackA(err, null);
                            }
                        }
                    )
                });
            });
        }
    });
}

function populateLiveLocations(callbackA) {
    console.log("Populating Live Locations...");

    LiveLocation.remove(function (err) {
        if (!err) {
            https.get(API_BASE_URL + "/vehicle_locations", function(res){
                var body = '';
                res.on('data', function(chunk) {
                    body += chunk;
                });

                res.on('end', function() {
                    var json = JSON.parse(body);

                    async.eachSeries(
                        json.vehicles,
                        function (vehicleJson, callbackB) {
                            // use mongodb coordinates so that 'near' queries can be made
                            var coordinates = [];
                            coordinates.push(vehicleJson.longitude);
                            coordinates.push(vehicleJson.latitude);
                            vehicleJson.coordinates = coordinates;
                            delete vehicleJson.latitude;
                            delete vehicleJson.longitude;

                            // only save if vehicle_id doesn't already exist in collection
                            LiveLocation
                                .find({vehicle_id: vehicleJson.vehicle_id})
                                .exec(function (err, liveLocations) {
                                    if (!err) {
                                        if (liveLocations.length == 0) {
                                            var liveLocation = new LiveLocation(vehicleJson);
                                            liveLocation.save(function(err) {
                                                if (!err) {
                                                    callbackB();
                                                }
                                            });
                                        } else {
                                            callbackB();
                                        }
                                    }
                                });
                        },
                        function (err) {
                            if (!err) {
                                console.log("DONE\n");
                                callbackA(err, null);
                            }
                        }
                    )
                });
            });
        }
    });
}

function populateStats(callbackA) {
    async.series([
        function(callback) {

            LiveLocation.find({}, 'vehicle_id', function(err, doc) {

                if(err){return next(err);}

                async.eachSeries(doc, function(loc, callbackA) {

                    var vehicleStat = {
                        date: moment().format('YYYY MM DD'),
                        vehicle_id: loc.vehicle_id,
                        early_5_plus: 0,
                        early_4: 0,
                        early_3: 0,
                        early_2: 0,
                        on_time: 0,
                        late_2: 0,
                        late_3: 0,
                        late_4: 0,
                        late_5_plus: 0,
                        total_count: 0,
                        modified: false
                    };

                    var vStat = new VehicleStat(vehicleStat);

                    vStat.save(function(err, post){

                        if(err){return next(err);}

                        callbackA();

                    });

                }, function(){

                    console.log('done building vehicle stats');

                    callback();

                });

            });


        },
        function(callback) {

            Stop.find({}, 'stop_id', function(err, stops){

                if(err){return next(err);}

                async.eachSeries(stops, function(stop, callbackA) {

                    var stopStat = {
                        date: moment().format('YYYY MM DD'),
                        stop_id: stop.stop_id,
                        early_5_plus: 0,
                        early_4: 0,
                        early_3: 0,
                        early_2: 0,
                        on_time: 0,
                        late_2: 0,
                        late_3: 0,
                        late_4: 0,
                        late_5_plus: 0,
                        total_count: 0,
                        modified: false

                    };

                    var sStat = new StopStat(stopStat);

                    sStat.save(function(err, post){

                        if(err){return next(err);}
                        callbackA();

                    });

                }, function(err) {

                    if(err){return next(err);}

                    console.log('done building stop stats');
                    callback();
                });

            });

        }

    ], function(err) {
        callbackA();
        console.log('Stats populated');
    });
}

function updateStats() {
    setInterval(function() {

        async.waterfall(
            [
                function (callback) {
                    //Clear the old data
                    LiveLocation.remove({}, function (err) {

                        if (err) {return next(err);}

                        https.get(API_BASE_URL + "/vehicle_locations", function (res) {

                            var body = '';

                            res.on('data', function (chunk) {

                                body += chunk;

                            });

                            res.on('end', function () {

                                console.log('end data');

                                callback(null, body);

                            });
                        });

                    });

                },

                function (body, callback) {
                    var json = JSON.parse(body);
                    var doc = {};

                    async.eachSeries(json.vehicles, function(vehicleDoc, callbackA) {

                        var coordinates = [];
                        coordinates.push(vehicleDoc.longitude);
                        coordinates.push(vehicleDoc.latitude);
                        vehicleDoc.coordinates = coordinates;
                        delete vehicleDoc.latitude;
                        delete vehicleDoc.longitude;

                        //Convert unix timestamp to "HH:MM" so that it can be compared with departure times in Journeys or Timetables
                        //12 Hour format
                        var date = new Date(vehicleDoc.last_gps_fix * 1000);
                        var hour = date.getHours();
                        if (hour > 12)
                            hour = hour % 12;
                        var hourString = String(hour);
                        var minutes = date.getMinutes();
                        var minutesString = String(minutes);
                        if (minutes < 10)
                            minutesString = "0" + minutesString;
                        var time = hourString + ":" + minutesString;
                        vehicleDoc.time = time;

                        var loc = new LiveLocation(vehicleDoc);

                        loc.save(function (err, post) {

                            if (err) {return next(err);}

                            callbackA();
                        });
                    }, function(err) {

                        if(err){next(err);}

                        callback();

                    });

                }
                ,

                function (callback) {
                    // return these fields of each location document in the database
                    LiveLocation.find({}, 'service_name coordinates vehicle_id last_gps_fix', function (err, doc) {

                        if (err) {
                            return next(err);
                        }

                        callback(err, doc);

                    });
                },

                function (doc, callback) {
                    console.log('buses near');

                    var buses_near_stops = [];

                    //Iterate through every bus location, store any that are near a stop.
                    async.eachSeries(doc, function (bus, callbackA) {

                        Stop.findOne({
                            coordinates: {$near: bus.coordinates, $maxDistance: .0001}
                        }, function (err, stop) {
                            if (err) {
                                return next(err);
                            }

                            if (stop !== null && bus.service_name !== null) {

                                var service_name_of_bus = bus.service_name;

                                var services_of_stop = stop.services;

                                async.eachSeries(services_of_stop, function (service_id, callbackC) {
                                    if (service_name_of_bus === service_id) {
                                        buses_near_stops.push(
                                            {
                                                time: bus.last_gps_fix,
                                                bus_coords: bus.coordinates,
                                                stop_coords: stop.coordinates,
                                                vehicle_id: bus.vehicle_id,
                                                stop_id: stop.stop_id,
                                                service_name: service_name_of_bus
                                            });
                                    }

                                    callbackC();

                                });
                                callbackA();
                            }
                            else {
                                callbackA();
                            }

                        });

                    }, function (err) {
                        callback(null, buses_near_stops);
                    });


                },

                function (buses_near_stops, callback) {

                    //Iterate through each bus that is near any stop
                    async.eachSeries(buses_near_stops, function (bus, callbackA) {

                        //Find all timetables that match the stop_id and the service of the bus that is at that stop
                        //If this list is nonempty, it means that the bus is at a stop on its current service
                        Timetable.find({

                            service_name: bus.service_name,
                            stop_id: bus.stop_id

                        }, 'timestamp time', function (err, timestamps) {

                            if (err) {return next(err);}

                            if(timestamps.length > 0) {


                                //Out of all the timetables for this stop and service, find the one that is closest in time
                                //to the time of the last gps_fix of this bus

                                var minDif = null;

                                for (var t in timestamps) {
                                    var timestamp = timestamps[t].timestamp;

                                    //Negative if early, positive if late
                                    var negDif = bus.time - timestamp;
                                    var absDif = Math.abs(negDif);

                                    if (minDif === null || absDif < Math.abs(minDif)) {

                                        minDif = negDif;

                                    }
                                }

                                //Determine how late/early the bus is, update the vehicle stat corresponding to this bus
                                VehicleStat.findOne({vehicle_id: bus.vehicle_id, date: moment().format('YYYY MM DD')}, function (err, vehicleStat) {

                                    //Not sure why vehicleStat goes out of scope
                                    var vehicleStatNew = vehicleStat;

                                    StopStat.findOne({stop_id: bus.stop_id, date: moment().format('YYYY MM DD')}, function(err, stopStat){



                                        if (err) {

                                            console.log('vehicle error');
                                            return next(err);

                                        }


                                        // If a new vehicle comes online after stats are first built
                                        if(vehicleStatNew === null) {

                                            var vehicleStat = {
                                                date: moment().format('YYYY MM DD'),
                                                vehicle_id: bus.vehicle_id,
                                                early_5_plus: 0,
                                                early_4: 0,
                                                early_3: 0,
                                                early_2: 0,
                                                on_time: 0,
                                                late_2: 0,
                                                late_3: 0,
                                                late_4: 0,
                                                late_5_plus: 0,
                                                total_count: 0,
                                                modified: false
                                            };

                                            var vStat = new VehicleStat(vehicleStat);

                                            vStat.save(function(err, post) {

                                                if (err) {return next(err);}

                                                callbackA();

                                            });

                                            console.log('null stat ' + bus.vehicle_id);
                                            console.log('There is a mismatch between locations and vehiclestats');
                                            callbackA();

                                        }
                                        else {

                                            var minutesDif = minDif / 60;
                                            console.log('minDif ' + minDif);
                                            console.log('minutesDif: ' + minutesDif);


                                            if (minutesDif < -5) {
                                                stopStat.early_5_plus++;
                                                vehicleStatNew.early_5_plus++;
                                                console.log('1');
                                            }

                                            else if (minutesDif >= -4 && minutesDif < -3) {
                                                stopStat.early_4++;
                                                vehicleStatNew.early_4++;
                                                console.log('2');
                                            }

                                            else if (minutesDif >= -3 && minutesDif < -2) {
                                                stopStat.early_3++;
                                                vehicleStatNew.early_3++;
                                                console.log('3');
                                            }

                                            else if (minutesDif >= -2 && minutesDif < -1) {
                                                stopStat.early_2++;
                                                vehicleStatNew.early_2++;
                                                console.log('4');
                                            }

                                            else if (minutesDif < 2 && minutesDif > 1) {
                                                stopStat.late_2++;
                                                vehicleStatNew.late_2++;
                                                console.log('5');
                                            }

                                            else if (minutesDif < 3 && minutesDif > 2) {
                                                stopStat.late_3++;
                                                vehicleStatNew.late_3++;
                                                console.log('6');
                                            }

                                            else if (minutesDif < 4 && minutesDif > 3) {
                                                stopStat.late_4++;
                                                vehicleStatNew.late_4++;
                                                console.log('7');
                                            }

                                            else if (minutesDif > 5) {
                                                stopStat.late_5_plus++;
                                                vehicleStatNew.late_5_plus++;
                                                console.log('8');
                                            }

                                            else {
                                                console.log('on time');
                                                stopStat.on_time++;
                                                vehicleStatNew.on_time++;

                                            }

                                            vehicleStatNew.modified = true;
                                            stopStat.modified = true;

                                            vehicleStatNew.save(function (err, product, numberAffected) {

                                                stopStat.save(function(err, product,numberAffected){
                                                    callbackA();

                                                });
                                            });

                                        }
                                    })

                                });

                            }
                            else {

                                callbackA();
                                console.log('no timestamps');

                            }
                        });


                    }, function (err) {

                        console.log('callback');

                        callback();

                    });

                }
            ],

            function (err, results) {
                console.log('end');

            });
    }, 15000);
}


// function calls go here
mongoose.connect(dbConfig.url);
mongoose.connection.once('open', function() {
    var arg = process.argv[2];
    var finalCallback = function (err) {
        if (err) {
            console.log(err.message);
        }

        console.timeEnd("total execution time");
        console.log("END OF DB POPULATION SCRIPT");
        process.exit(0);
    };

    if (arg == "all") {
        console.time("total execution time");
        async.series(
            [
                populateStops,
                populateServices,
                populateTimetables,
                populateServiceStatuses,
                populateLiveLocations,
                populateStats
            ],
            finalCallback
        );
    }
    else if (arg == "update_stats") {
        console.time("total execution time");
        updateStats();
    }
    else {
        console.log("Invalid arguments. Only 'all' and 'live' are allowed.");
        process.exit(1);
    }
});
