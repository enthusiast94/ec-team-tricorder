var mongoose = require('mongoose');

var LocationSchema = new mongoose.Schema({
    vehicle_id: {type: String, index: true},
    last_gps_fix: {type: Number, index: true},
    time: {type: String, index: true},
    coordinates: {type: [Number], index: '2d'},
    speed: Number,
    heading: Number,
    service_name: {type: String, index: true},
    destination: {type: String, index: true}
});

mongoose.model('Location', LocationSchema);