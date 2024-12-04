const ical = require('ical-generator');

class CalendarService {
    constructor() {
        this.calendar = ical({
            name: 'Royal Barbershop Appointments',
            timezone: 'Europe/Belgrade',
            method: 'REQUEST'
        });
    }

    async addEvent({ startDateTime, endDateTime, summary, description, location, attendees }) {
        try {
            // Ensure correct timezone handling
            const start = new Date(startDateTime);
            const end = new Date(endDateTime);
            
            const event = this.calendar.createEvent({
                start: start,
                end: end,
                summary: `📅 Nova Rezervacija: Royal Barbershop - ${summary}`,
                description: description,
                location: location,
                organizer: {
                    name: process.env.SHOP_NAME,
                    email: process.env.SHOP_EMAIL
                },
                attendees: [{ email: process.env.SHOP_EMAIL }],
                status: 'CONFIRMED',
                sequence: 0,
                busyStatus: 'BUSY',
                alarms: [{ type: 'display', trigger: 900 }],
                method: 'REQUEST'
            });

            return {
                success: true,
                eventId: event.uid(),
                iCalString: this.calendar.toString()
            };
        } catch (error) {
            console.error('Failed to create iCal event:', error);
            return { success: false, eventId: null, error: error.message };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };