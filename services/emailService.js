const nodemailer = require('nodemailer');
const { calendarService } = require('./calendarService');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendOwnerNotification(appointment) {
        const serviceName = this.getServiceName(appointment.service);
        
        try {
            // Parse the date and time correctly
            const [year, month, day] = appointment.date.split('-');
            const [hours, minutes] = appointment.time.split(':');
            
            // Create date in Belgrade timezone
            const startDateTime = new Date();
            startDateTime.setFullYear(parseInt(year));
            startDateTime.setMonth(parseInt(month) - 1);
            startDateTime.setDate(parseInt(day));
            startDateTime.setHours(parseInt(hours));
            startDateTime.setMinutes(parseInt(minutes));
            startDateTime.setSeconds(0);
            startDateTime.setMilliseconds(0);

            // Create end time (30 minutes later)
            const endDateTime = new Date(startDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + 30);

            // Format the date for email using Intl.DateTimeFormat
            const dateFormatter = new Intl.DateTimeFormat('sr-Latn-BA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'Europe/Belgrade'
            });

            const formattedDate = dateFormatter.format(startDateTime);

            // Create calendar event
            const calendarResult = await calendarService.addEvent({
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                summary: `Royal Barbershop - ${serviceName}`,
                description: `Client: ${appointment.name}\nPhone: ${appointment.phone}\nEmail: ${appointment.email}`,
                location: process.env.SHOP_ADDRESS,
                attendees: [{ email: process.env.SHOP_EMAIL, name: process.env.SHOP_NAME }]
            });
            
            const emailContent = {
                from: process.env.EMAIL_USER,
                to: process.env.SHOP_EMAIL,
                subject: `📅 Nova Rezervacija: Royal Barbershop - ${serviceName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #D4AF37; border-radius: 15px; overflow: hidden;">
                        <div style="background-color: #D4AF37; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; text-transform: uppercase;">Nova Rezervacija</h1>
                        </div>
                        
                        <div style="background-color: #1a1a1a; padding: 30px;">
                            <div style="background-color: #2c2c2c; border-radius: 10px; padding: 25px; margin-bottom: 20px; border-left: 4px solid #D4AF37;">
                                <h2 style="color: #D4AF37; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Detalji Rezervacije</h2>
                                
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Usluga:</strong> ${serviceName}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Datum:</strong> ${formattedDate}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Vrijeme:</strong> ${appointment.time}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Lokacija:</strong> ${process.env.SHOP_ADDRESS}
                                </p>
                            </div>

                            <div style="background-color: #2c2c2c; border-radius: 10px; padding: 25px; border-left: 4px solid #D4AF37;">
                                <h2 style="color: #D4AF37; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Informacije o Klijentu</h2>
                                
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Ime:</strong> ${appointment.name}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Telefon:</strong> ${appointment.phone}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Email:</strong> ${appointment.email}
                                </p>
                            </div>
                        </div>
                        
                        <div style="background-color: #1a1a1a; color: #ffffff; text-align: center; padding: 15px; font-size: 12px;">
                            <p style="margin: 0;">Kalendarski dogadjaj je automatski dodat u vas Apple Calendar.</p>
                        </div>
                    </div>
                `,
                attachments: [{
                    filename: 'appointment.ics',
                    content: calendarResult.iCalString,
                    contentType: 'text/calendar'
                }]
            };

            await this.transporter.sendMail(emailContent);
            console.log('Owner notification email sent with calendar attachment');
            return {
                success: true,
                calendarEventId: calendarResult.eventId
            };
        } catch (error) {
            console.error('Failed to send owner notification email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getServiceEmoji(service) {
        const emojis = {
            'brada': '🪒',
            'kosa': '✂️',
            'bradaikosa': '💈'
        };
        return emojis[service] || '✨';
    }

    getServiceName(service) {
        const services = {
            'brada': 'Brijanje',
            'kosa': 'Šišanje',
            'bradaikosa': 'Brijanje i Šišanje'
        };
        return services[service] || service;
    }
}

const emailService = new EmailService();
module.exports = { emailService }; 