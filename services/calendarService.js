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

    async addEvent({ startDateTime, endDateTime, summary, description, location, duration }) {
        try {
            // Parse the date and time properly
            const startDate = new Date(startDateTime);
            // Calculate end time based on duration
            const endDate = new Date(startDate.getTime() + (duration * 60 * 1000));
            
            // Format dates in ISO string with timezone offset
            const timeZone = 'Europe/Belgrade';
            const startTimeFormatted = startDate.toLocaleString('en-US', { timeZone });
            const endTimeFormatted = endDate.toLocaleString('en-US', { timeZone });

            const event = {
                summary,
                location,
                description,
                start: {
                    dateTime: new Date(startTimeFormatted).toISOString(),
                    timeZone: timeZone,
                },
                end: {
                    dateTime: new Date(endTimeFormatted).toISOString(),
                    timeZone: timeZone,
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 10 }
                    ],
                },
            };

            console.log('Creating calendar event:', {
                startTime: event.start.dateTime,
                endTime: event.end.dateTime,
                timeZone: event.start.timeZone
            });

            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            return {
                success: true,
                eventId: response.data.id
            };
        } catch (error) {
            console.error('Calendar Event Creation Error:', {
                error: error.message,
                stack: error.stack,
                input: {
                    startDateTime,
                    endDateTime,
                    duration
                }
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };