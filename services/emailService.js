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
        try {
            // Format the date and time for calendar
            const [year, month, day] = appointment.date.split('-');
            const [hours, minutes] = appointment.time.split(':');
            
            // Create date in local timezone
            const appointmentDate = new Date(
                parseInt(year),
                parseInt(month) - 1, // Month is 0-based
                parseInt(day),
                parseInt(hours),
                parseInt(minutes)
            );

            // Set timezone to Belgrade
            const timeZone = 'Europe/Belgrade';
            const formatter = new Intl.DateTimeFormat('sr-Latn', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timeZone
            });

            const formattedDateTime = formatter.format(appointmentDate);
            
            // Get service name
            const serviceName = this.getServiceName(appointment.service);
            
            // Create calendar event
            const calendarResult = await calendarService.addEvent({
                startDateTime: appointmentDate,
                duration: appointment.duration,
                summary: `${serviceName} - ${appointment.name}`,
                description: `
                    Klijent: ${appointment.name}
                    Telefon: ${appointment.phone}
                    Email: ${appointment.email}
                    Usluga: ${serviceName}
                    Cijena: ${appointment.price} KM
                `,
                location: process.env.SHOP_ADDRESS,
                timeZone: timeZone
            });

            if (!calendarResult.success) {
                throw new Error('Failed to create calendar event');
            }

            // Send email with the formatted date
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
                                    <strong style="color: #D4AF37;">Datum i vrijeme:</strong> ${formattedDateTime}
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
                    </div>
                `
            };

            // Send the email
            await this.transporter.sendMail(emailContent);

            return {
                success: true,
                calendarEventId: calendarResult.eventId
            };

        } catch (error) {
            console.error('Email service error:', error);
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