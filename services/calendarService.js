const ical = require('ical-generator').default;

class CalendarService {
    async addEvent({ startDateTime, endDateTime, summary, description, location, attendees }) {
        try {
            const calendar = ical({
                name: process.env.SHOP_NAME,
                timezone: 'Europe/Belgrade',
                method: 'REQUEST'
            });
            
            const event = calendar.createEvent({
                start: startDateTime,
                end: endDateTime,
                summary: summary,
                description: description,
                location: location,
                timezone: 'Europe/Belgrade',
                organizer: {
                    name: process.env.SHOP_NAME,
                    email: process.env.SHOP_EMAIL
                },
                attendees: attendees,
                status: 'CONFIRMED',
                sequence: 0,
                busyStatus: 'BUSY',
                alarms: [{ type: 'display', trigger: 900 }],
                method: 'REQUEST',
                uid: `${Date.now()}@${process.env.SHOP_NAME.replace(/\s+/g, '').toLowerCase()}.com`
            });

            return {
                success: true,
                eventId: event.uid(),
                iCalString: calendar.toString()
            };
        } catch (error) {
            console.error('Failed to create iCal event:', error);
            return { success: false, eventId: null, error: error.message };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };