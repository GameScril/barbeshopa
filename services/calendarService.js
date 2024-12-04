const ical = require('ical-generator');

class CalendarService {
    constructor() {
        this.calendar = ical({
            name: 'Royal Barbershop Appointments',
            timezone: 'Europe/Belgrade'
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
                attendees: attendees.map(attendee => ({
                    email: attendee.email,
                    name: attendee.name || '',
                })),
                alarms: [{ type: 'display', trigger: 1800 }]
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