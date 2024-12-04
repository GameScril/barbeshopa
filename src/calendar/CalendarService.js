const ical = require('ical-generator');
require('dotenv').config();

class CalendarService {
  async addEvent(event) {
    try {
      const calendar = ical({
        name: process.env.SHOP_NAME,
        timezone: 'Europe/Belgrade',
        method: 'REQUEST'
      });

      const startDate = new Date(event.startDateTime);
      const endDate = new Date(event.endDateTime);

      const calendarEvent = calendar.createEvent({
        start: startDate,
        end: endDate,
        summary: event.summary,
        description: event.description,
        location: event.location,
        organizer: {
          name: process.env.SHOP_NAME,
          email: process.env.SHOP_EMAIL
        },
        attendees: [{ 
          email: process.env.SHOP_EMAIL,
          name: process.env.SHOP_NAME
        }],
        status: 'CONFIRMED',
        sequence: 0,
        busyStatus: 'BUSY',
        alarms: [{
          type: 'display',
          trigger: 900
        }],
        method: 'REQUEST',
        uid: `${Date.now()}@${process.env.SHOP_NAME.replace(/\s+/g, '').toLowerCase()}.com`
      });

      return {
        success: true,
        eventId: calendarEvent.uid(),
        iCalString: calendar.toString()
      };
    } catch (error) {
      console.error('Error generating calendar event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const calendarService = new CalendarService();
module.exports = { calendarService }; 