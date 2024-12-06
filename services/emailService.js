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
            console.log('Received appointment:', appointment);

            if (!appointment.date.match(/^\d{4}-\d{2}-\d{2}$/) || 
                !appointment.time.match(/^\d{2}:\d{2}$/)) {
                throw new Error('Invalid date or time format');
            }

            // Parse the date without timezone conversion
            const [year, month, day] = appointment.date.split('-').map(Number);
            
            // Create date object for the selected date
            const date = new Date(Date.UTC(year, month - 1, day));
            
            // Get day name in Serbian
            const dayNames = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
            const dayName = dayNames[date.getUTCDay()];
            
            // Get month name in Serbian
            const monthNames = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
            const monthName = monthNames[date.getUTCMonth()];
            
            // Create the time strings with explicit timezone
            const startTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${appointment.time}:00+01:00`;
            
            // Calculate end time
            const [hours, minutes] = appointment.time.split(':').map(Number);
            let endHours = hours;
            let endMinutes = minutes + 30;
            
            if (endMinutes >= 60) {
                endHours += 1;
                endMinutes -= 60;
            }
            
            const endTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00+01:00`;
            
            // Construct the formatted date string
            const formattedDate = `${dayName}, ${day}. ${monthName} ${year}. ${appointment.time}`;

            console.log('Date Processing:', {
                receivedDate: appointment.date,
                parsedComponents: { year, month, day },
                utcDate: date.toISOString(),
                formattedDate,
                startTimeString,
                endTimeString
            });

            // Add event to Google Calendar
            const calendarResult = await calendarService.addEvent({
                startDateTime: startTimeString,
                endDateTime: endTimeString,
                summary: `${appointment.name} - ${serviceName}`,
                description: `
📱 ${appointment.phone}
💈 ${serviceName}
💰 ${appointment.price} KM

Email: ${appointment.email}
            `.trim(),
                location: process.env.SHOP_ADDRESS
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
                                    <strong style="color: #D4AF37;">Datum i vrijeme:</strong> ${formattedDate}
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
                            <p style="margin: 0;">Dogadjaj je automatski dodat u vas Google Calendar.</p>
                        </div>
                    </div>
                `
            };

            // Send single email to owner
            await this.transporter.sendMail(emailContent);
            
            return {
                success: true,
                calendarEventId: calendarResult.eventId
            };
        } catch (error) {
            console.error('Date/time validation failed:', error);
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