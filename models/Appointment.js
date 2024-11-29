const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true,
        enum: ['brada', 'kosa', 'bradaikosa']
    },
    price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Unesite validnu email adresu']
    },
    calendarEventId: String
});

module.exports = mongoose.model('Appointment', appointmentSchema); 