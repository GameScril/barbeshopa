const { google } = require('googleapis');

class CalendarService {
    constructor() {
        const requiredVars = [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_REDIRECT_URI'
        ];

        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            console.warn(`Calendar integration disabled. Missing: ${missingVars.join(', ')}`);
            this.isConfigured = false;
            return;
        }

        this.isConfigured = true;
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

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
        if (!this.isConfigured) return null;
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
            prompt: 'consent'
        });
    }

    async addEvent({ startDateTime, duration, summary, description, location }) {
        if (!this.isConfigured) {
            return { success: false, error: 'Calendar integration not configured' };
        }
        try {
            // Parse the date and time properly
            const startDate = new Date(startDateTime);
            // Calculate end time based on duration
            const endDate = new Date(startDate.getTime() + (duration * 60 * 1000));
            
            const timeZone = 'Europe/Belgrade';
            
            const event = {
                summary,
                location,
                description,
                start: {
                    dateTime: startDate.toISOString(),
                    timeZone,
                },
                end: {
                    dateTime: endDate.toISOString(),
                    timeZone,
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 10 }
                    ],
                },
                organizer: {
                    email: process.env.SHOP_EMAIL,
                    displayName: process.env.SHOP_NAME
                }
            };

            console.log('Creating calendar event:', {
                startTime: event.start.dateTime,
                endTime: event.end.dateTime,
                timeZone: event.start.timeZone,
                duration
            });

            // Actually create the event in Google Calendar
            const response = await this.calendar.events.insert({
                calendarId: 'primary', // Use the primary calendar
                requestBody: event,
            });

            console.log('Calendar event created:', response.data);

            return {
                success: true,
                eventId: response.data.id,
                htmlLink: response.data.htmlLink // URL to view the event
            };
        } catch (error) {
            console.error('Error creating calendar event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };