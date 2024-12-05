const { google } = require('googleapis');

class CalendarService {
    constructor() {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
            console.error('Missing required Google Calendar credentials in environment variables');
        }

        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            console.error('Missing Google Calendar refresh token');
        }

        this.oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        this.calendar = google.calendar({ 
            version: 'v3', 
            auth: this.oauth2Client 
        });
    }

    async addEvent({ startDateTime, endDateTime, summary, description, location }) {
        try {
            const event = {
                summary,
                location,
                description,
                start: {
                    dateTime: startDateTime,
                    timeZone: 'Europe/Belgrade',
                },
                end: {
                    dateTime: endDateTime,
                    timeZone: 'Europe/Belgrade',
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 30 }
                    ],
                },
            };

            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            return {
                success: true,
                eventId: response.data.id
            };
        } catch (error) {
            console.error('Error creating Google Calendar event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };