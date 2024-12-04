const ical = require('ical-generator');
require('dotenv').config();

class CalendarService {
  async addEvent(event) {
    const calendar = ical.default({
      name: process.env.SHOP_NAME,
      timezone: 'Europe/Belgrade',
      method: 'REQUEST'
    });

    const calendarEvent = calendar.createEvent({
      start: event.startDateTime,
      end: event.endDateTime,
      summary: event.summary,
      description: event.description,
      location: event.location,
      organizer: {
        name: process.env.SHOP_NAME,
        email: process.env.SHOP_EMAIL
      },
      attendees: [{ email: process.env.SHOP_EMAIL }],
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
  }
}

const calendarService = new CalendarService();
module.exports = { calendarService }; 