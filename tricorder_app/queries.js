//Get a list of all services that have buses on them
//Returns an array of strings
var active_services = db.locations.find().map(function(a){return a.service_name});


//Create an array of objects.  Each object has the name of the service and its array of stop coordinates

var active_service_coords = [];

active_services.forEach(function(j,k){
    if(j !== null){

        printjson(j);
        active_service_coords.push(
            {
                name: String(j),
                points: db.services.findOne({name: String(j)}).routes[0].points

            }
        );
    }
});

//Better idea: get the coordinates from each bus.  Query stops with the coordinates using near.  For each bus, if a stop is returned, check if that stop is on the buses service.

var bus_coords = db.locations.find().map(function(a){return {service_name: a.service_name, coordinates: a.coordinates, vehicle_id: a.vehicle_id}});

var busses_near_stops = [];

bus_coords.forEach(function(j,k) {
    //Making sure it returns 1 stop now because I don't know proper distance
//	print(j);
    var stop = db.stops.findOne({
        coordinates: { $near : j.coordinates, $maxDistance: .00001}
    });
//	print(stop);
    if(stop !== null && j.service_name !== null) {
        var service_name_of_bus = j.service_name;

        var service_of_name = db.services.findOne({name: service_name_of_bus});
        //	printjson(service_of_name);
        if(service_of_name.routes[0].stops.indexOf(stop.stop_id) > -1) {

            busses_near_stops.push(
                {
                    bus_coords: j,
                    stop_coords: stop.coordinates,
                    vehicle_id: j.vehicle_id,
                    stop_id: stop.stop_id,
                    service_name: service_name_of_bus
                });
        }
    }

});

//For each element in busses_near_stops, I want to compare the current time to the time that the bus is supposed to be at that stop, using Journeys
busses_near_stops.forEach(function(j,k){
    var journey = db.journeys.find({service_name: j.service_name});

});
