const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

const addToGoogleCalendar = async (appointment, attendeeEmail) => {
    try {
        const year = appointment.date.getFullYear();
        const month = appointment.date.getMonth();
        const day = appointment.date.getDate();
        const [hour, minute] = appointment.time.split(':').map(Number);

        const startDateTime = new Date(year, month, day, hour, minute);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

        const event = {
            summary: `Royal Barbershop - ${getServiceName(appointment.service)}`,
            location: process.env.SHOP_ADDRESS,
            description: `Klijent: ${appointment.name}\nTelefon: ${appointment.phone}\nEmail: ${appointment.email}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Europe/Belgrade',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Europe/Belgrade',
            },
            attendees: [
                { email: attendeeEmail },
                { email: process.env.SHOP_EMAIL }
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 30 }
                ],
            },
            guestsCanModify: false,
            guestsCanInviteOthers: false,
            guestsCanSeeOtherGuests: false,
            transparency: "opaque",
            visibility: "private",
            sendUpdates: "all",
            status: "confirmed"
        };

        const response = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            resource: event,
            sendNotifications: true,
            supportsAttachments: true,
            conferenceDataVersion: 0,
            sendUpdates: 'all',
        });

        return response.data;
    } catch (error) {
        console.error('Error adding event to Google Calendar:', error);
        throw error;
    }
};

function getServiceName(service) {
    const services = {
        'brada': 'Brijanje',
        'kosa': 'Šišanje',
        'bradaikosa': 'Brijanje i Šišanje'
    };
    return services[service] || service;
}

module.exports = { addToGoogleCalendar }; 