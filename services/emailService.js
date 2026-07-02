const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
        this.fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER;
    }

    createTransporter() {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER || process.env.EMAIL_USER;
        const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

        if (host) {
            // Force port 465 and secure for Gmail to bypass ISP blocks on port 587
            const isGmail = host === 'smtp.gmail.com';
            const smtpPort = isGmail ? 465 : Number(process.env.SMTP_PORT || 587);
            const secure = isGmail ? true : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);

            return nodemailer.createTransport({
                host: host,
                port: smtpPort,
                secure,
                requireTLS: !secure,
                connectionTimeout: 15000,
                greetingTimeout: 15000,
                socketTimeout: 30000,
                auth: user && pass ? {
                    user: user,
                    pass: pass
                } : undefined
            });
        }

        if (user && pass) {
            const isGmail = user.includes('@gmail.com');
            return nodemailer.createTransport({
                service: isGmail ? 'gmail' : undefined,
                port: isGmail ? 465 : 587,
                secure: isGmail ? true : false,
                requireTLS: !isGmail,
                connectionTimeout: 15000,
                greetingTimeout: 15000,
                socketTimeout: 30000,
                auth: {
                    user: user,
                    pass: pass
                }
            });
        }

        return null;
    }

    async sendOwnerNotification(appointment) {
        try {
            if (!this.transporter) {
                return {
                    success: false,
                    error: 'Email transport is not configured'
                };
            }

            if (!this.fromAddress) {
                return {
                    success: false,
                    error: 'Email sender address (EMAIL_FROM, EMAIL_USER, or SMTP_USER) is not configured'
                };
            }

            const toAddress = process.env.SHOP_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER || this.fromAddress;
            if (!toAddress) {
                return {
                    success: false,
                    error: 'Email recipient address (SHOP_EMAIL, EMAIL_USER, or SMTP_USER) is not configured'
                };
            }

            // Format the date and time safely
            let formattedDateTime = '';
            try {
                if (appointment.date && appointment.time) {
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

                    formattedDateTime = formatter.format(appointmentDate);
                } else {
                    formattedDateTime = `${appointment.date || ''} ${appointment.time || ''}`;
                }
            } catch (formatError) {
                console.error('Error formatting date/time for email:', formatError);
                formattedDateTime = `${appointment.date || ''} ${appointment.time || ''}`;
            }
            
            // Get service name
            const serviceName = this.getServiceName(appointment.service);

            const calendarLink = appointment.calendarLink || appointment.htmlLink || null;

            // Send email to shop owner
            const emailContent = {
                from: this.fromAddress,
                to: toAddress,
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
                                ${calendarLink ? `
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Google Calendar:</strong> <a href="${calendarLink}" style="color: #D4AF37;">Otvori događaj</a>
                                </p>
                                ` : ''}
                            </div>

                            <div style="background-color: #2c2c2c; border-radius: 10px; padding: 25px; border-left: 4px solid #D4AF37;">
                                <h2 style="color: #D4AF37; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Informacije o Klijentu</h2>
                                
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Ime:</strong> ${appointment.name}
                                </p>
                                <p style="margin: 10px 0; color: #ffffff;">
                                    <strong style="color: #D4AF37;">Telefon:</strong> ${appointment.phone}
                                </p>
                            </div>
                        </div>
                    </div>
                `
            };

            // Send the email
            await this.transporter.sendMail(emailContent);

            return {
                success: true
            };
        } catch (error) {
            if (error && error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Email notification timed out'
                };
            }

            console.error('Error sending notification:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getServiceEmoji(service) {
        const emojis = {
            pranje: '🫧',
            depilacija: '✨',
            ciscenjeusiju: '👂',
            sisanje: '✂️',
            brada: '🪒',
            sisanjeibrada: '💈',
            kosa: '✂️',
            bradaikosa: '💈'
        };
        return emojis[service] || '✨';
    }

    getServiceName(service) {
        const services = {
            pranje: 'Pranje',
            depilacija: 'Depilacija',
            ciscenjeusiju: 'Čišćenje ušiju',
            sisanje: 'Šišanje',
            brada: 'Brada',
            sisanjeibrada: 'Šišanje i brada',
            kosa: 'Šišanje',
            bradaikosa: 'Šišanje i brada'
        };
        return services[service] || service;
    }
}

const emailService = new EmailService();
module.exports = { emailService }; 