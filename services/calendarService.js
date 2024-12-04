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
            const event = this.calendar.createEvent({
                start: startDateTime,
                end: endDateTime,
                summary: summary,
                description: description,
                location: location,
                organizer: {
                    name: process.env.SHOP_NAME,
                    email: process.env.SHOP_EMAIL
                },
                attendees: attendees.map(attendee => ({
                    email: attendee.email,
                    name: attendee.name || '',
                })),
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