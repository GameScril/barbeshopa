const nodemailer = require('nodemailer');
const ical = require('ical-generator');
require('dotenv').config();

class CalendarService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async addEvent(event) {
    const calendar = ical.default({
      name: process.env.SHOP_NAME,
      timezone: 'Europe/Belgrade',
      method: 'REQUEST'
    });

    calendar.createEvent({
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

    // Parse client info from description
    const lines = event.description.split('\n');
    const clientName = lines[0].split(': ')[1];
    const clientPhone = lines[1].split(': ')[1];
    const clientEmail = lines[2].split(': ')[1];

    const mailOptions = {
      from: `"${process.env.SHOP_NAME}" <${process.env.EMAIL_USER}>`,
      to: process.env.SHOP_EMAIL,
      subject: `🗓 Nova Rezervacija: ${event.summary}`,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a1a1a; color: #ffffff; border-radius: 15px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: #D4AF37; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; text-transform: uppercase;">Nova Rezervacija</h1>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px;">
            <!-- Appointment Details Section -->
            <div style="background-color: #2c2c2c; border-radius: 10px; padding: 25px; margin-bottom: 20px; border-left: 4px solid #D4AF37;">
              <h2 style="color: #D4AF37; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Detalji Rezervacije</h2>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Usluga:</strong> 
                <span style="color: #ffffff;">${event.summary}</span>
              </p>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Datum:</strong> 
                <span style="color: #ffffff;">${event.startDateTime.toLocaleDateString('sr-Latn', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </p>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Vrijeme:</strong> 
                <span style="color: #ffffff;">${event.startDateTime.toLocaleTimeString('sr-Latn', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </p>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Lokacija:</strong> 
                <span style="color: #ffffff;">${event.location}</span>
              </p>
            </div>

            <!-- Client Information Section -->
            <div style="background-color: #2c2c2c; border-radius: 10px; padding: 25px; border-left: 4px solid #D4AF37;">
              <h2 style="color: #D4AF37; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Informacije o Klijentu</h2>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Ime:</strong> 
                <span style="color: #ffffff;">${clientName}</span>
              </p>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Telefon:</strong> 
                <span style="color: #ffffff;">${clientPhone}</span>
              </p>
              <p style="margin: 10px 0; font-size: 16px; line-height: 1.5;">
                <strong style="color: #D4AF37;">Email:</strong> 
                <span style="color: #ffffff;">${clientEmail}</span>
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #2c2c2c; padding: 20px; text-align: center; border-top: 1px solid #D4AF37;">
            <p style="color: #999999; margin: 0; font-size: 14px;">
              Kalendarski događaj je automatski dodat u vaš Apple Calendar.
            </p>
          </div>
        </div>
      `,
      alternatives: [{
        contentType: 'text/calendar; method=REQUEST',
        content: calendar.toString()
      }],
      icalEvent: {
        filename: 'appointment.ics',
        method: 'REQUEST',
        content: calendar.toString()
      }
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send calendar invitation:', error);
      throw error;
    }
  }
}

const calendarService = new CalendarService();
module.exports = { calendarService }; 