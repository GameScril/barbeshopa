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
                alarms: [
                    { type: 'display', trigger: 1800 }, // 30 minutes before
                    { type: 'email', trigger: 86400 }   // 24 hours before
                ]
            });

            // Generate iCal file content
            const iCalString = this.calendar.toString();

            return {
                success: true,
                eventId: event.uid(), // Get UID directly from event
                iCalString: iCalString
            };
        } catch (error) {
            console.error('Failed to create iCal event:', error);
            return { 
                success: false, 
                eventId: null,
                error: error.message 
            };
        }
    }

    async deleteEvent(eventId) {
        try {
            // Remove event from calendar
            this.calendar.events().forEach(event => {
                if (event.uid() === eventId) {
                    this.calendar.removeEvent(event);
                }
            });
            return { success: true };
        } catch (error) {
            console.error('Failed to delete iCal event:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create a singleton instance
const calendarService = new CalendarService();

module.exports = { calendarService };