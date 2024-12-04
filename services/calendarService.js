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
                start: new Date(startDateTime),
                end: new Date(endDateTime),
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