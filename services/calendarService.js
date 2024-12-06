const { google } = require('googleapis');

class CalendarService {
    constructor() {
        // Validate environment variables
        const requiredVars = [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_REDIRECT_URI'
        ];

        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Only set credentials if refresh token exists
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            this.oauth2Client.setCredentials({
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN
            });
        }

        this.calendar = google.calendar({ 
            version: 'v3', 
            auth: this.oauth2Client 
        });
    }

    getAuthUrl() {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
            prompt: 'consent' // Force consent screen to get refresh token
        });
    }

    async addEvent({ startDateTime, endDateTime, summary, description, location }) {
        try {
            // Log calendar event creation for debugging
            console.log('Calendar Event Debug:', {
                startDateTime,
                endDateTime,
                timeZone: 'Europe/Belgrade'
            });

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
                        { method: 'popup', minutes: 30 },
                        { method: 'popup', minutes: 10 }
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