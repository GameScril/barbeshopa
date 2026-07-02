const https = require('https');

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
        this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN || null;
    }

    getAuthUrl() {
        if (!this.isConfigured) return null;
        const params = new URLSearchParams({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/calendar',
            prompt: 'consent',
            response_type: 'code',
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCodeForToken(code) {
        if (!this.isConfigured) {
            return { success: false, error: 'Calendar integration not configured' };
        }

        try {
            const authCode = Array.isArray(code) ? code[0] : code;
            const requestBody = new URLSearchParams({
                code: authCode,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            });

            const tokenData = await new Promise((resolve, reject) => {
                const request = https.request(
                    'https://oauth2.googleapis.com/token',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': Buffer.byteLength(requestBody.toString())
                        }
                    },
                    response => {
                        let responseText = '';

                        response.on('data', chunk => {
                            responseText += chunk;
                        });

                        response.on('end', () => {
                            try {
                                const parsed = responseText ? JSON.parse(responseText) : {};
                                if (response.statusCode && response.statusCode >= 400) {
                                    return reject({
                                        statusCode: response.statusCode,
                                        data: parsed
                                    });
                                }

                                resolve(parsed);
                            } catch (parseError) {
                                reject({
                                    statusCode: response.statusCode || 500,
                                    data: { raw: responseText, parseError: parseError.message }
                                });
                            }
                        });
                    }
                );

                request.on('error', reject);
                request.write(requestBody.toString());
                request.end();
            }).catch(error => {
                throw error;
            });

            const tokens = tokenData || {};
            if (tokens.refresh_token) {
                this.refreshToken = tokens.refresh_token;
            }

            return {
                success: true,
                refreshToken: tokens.refresh_token || null,
                accessToken: tokens.access_token || null
            };
        } catch (error) {
            console.error('Error exchanging Google auth code:', error);
            return {
                success: false,
                error: error?.data?.error || error.message || 'Token exchange failed',
                details: error?.data || error?.cause || null
            };
        }
    }

    async refreshAccessToken() {
        if (!this.isConfigured || !this.refreshToken) {
            return { success: false, error: 'Google refresh token is not configured' };
        }

        const requestBody = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token'
        }).toString();

        try {
            const tokenData = await new Promise((resolve, reject) => {
                const request = https.request(
                    'https://oauth2.googleapis.com/token',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': Buffer.byteLength(requestBody)
                        }
                    },
                    response => {
                        let responseText = '';

                        response.on('data', chunk => {
                            responseText += chunk;
                        });

                        response.on('end', () => {
                            try {
                                const parsed = responseText ? JSON.parse(responseText) : {};
                                if (response.statusCode && response.statusCode >= 400) {
                                    return reject({
                                        statusCode: response.statusCode,
                                        data: parsed
                                    });
                                }

                                resolve(parsed);
                            } catch (parseError) {
                                reject({
                                    statusCode: response.statusCode || 500,
                                    data: { raw: responseText, parseError: parseError.message }
                                });
                            }
                        });
                    }
                );

                request.on('error', reject);
                request.write(requestBody);
                request.end();
            });

            return {
                success: true,
                accessToken: tokenData.access_token || null,
                expiresIn: tokenData.expires_in || null
            };
        } catch (error) {
            return {
                success: false,
                error: error?.data?.error || error.message || 'Access token refresh failed',
                details: error?.data || null
            };
        }
    }

    async createCalendarEvent(accessToken, event) {
        const requestBody = JSON.stringify(event);

        return new Promise((resolve, reject) => {
            const request = https.request(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody)
                    }
                },
                response => {
                    let responseText = '';

                    response.on('data', chunk => {
                        responseText += chunk;
                    });

                    response.on('end', () => {
                        try {
                            const parsed = responseText ? JSON.parse(responseText) : {};
                            if (response.statusCode && response.statusCode >= 400) {
                                return reject({
                                    statusCode: response.statusCode,
                                    data: parsed
                                });
                            }

                            resolve(parsed);
                        } catch (parseError) {
                            reject({
                                statusCode: response.statusCode || 500,
                                data: { raw: responseText, parseError: parseError.message }
                            });
                        }
                    });
                }
            );

            request.on('error', reject);
            request.write(requestBody);
            request.end();
        });
    }

    async addEvent({ startDateTime, duration, summary, description }) {
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

            const tokenResult = await this.refreshAccessToken();
            if (!tokenResult.success || !tokenResult.accessToken) {
                return {
                    success: false,
                    error: tokenResult.error || 'Unable to refresh Google access token',
                    details: tokenResult.details || null
                };
            }

            const response = await this.createCalendarEvent(tokenResult.accessToken, event);

            console.log('Calendar event created:', response);

            return {
                success: true,
                eventId: response.id,
                htmlLink: response.htmlLink // URL to view the event
            };
        } catch (error) {
            console.error('Error creating calendar event:', error);
            return {
                success: false,
                error: error?.data?.error || error.message || 'Calendar event creation failed',
                details: error?.data || null
            };
        }
    }
}

const calendarService = new CalendarService();
module.exports = { calendarService };