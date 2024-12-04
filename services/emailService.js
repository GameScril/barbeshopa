const nodemailer = require('nodemailer');

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
        const emoji = this.getServiceEmoji(appointment.service);
        
        const emailContent = {
            from: process.env.EMAIL_USER,
            to: process.env.SHOP_EMAIL,
            subject: `✨ Nova Rezervacija - ${serviceName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <h2 style="color: #333; text-align: center; border-bottom: 2px solid #ddd; padding-bottom: 10px;">
                        ${emoji} Nova Rezervacija ${emoji}
                    </h2>
                    
                    <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">Usluga:</strong> 
                            <span style="color: #333;">${serviceName}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">📅 Datum:</strong> 
                            <span style="color: #333;">${new Date(appointment.date).toLocaleDateString('sr-RS', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">⏰ Vrijeme:</strong> 
                            <span style="color: #333;">${appointment.time}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">👤 Ime:</strong> 
                            <span style="color: #333;">${appointment.name}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">📱 Telefon:</strong> 
                            <span style="color: #333;">${appointment.phone}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">📧 Email:</strong> 
                            <span style="color: #333;">${appointment.email}</span>
                        </p>
                        <p style="font-size: 16px; margin: 10px 0;">
                            <strong style="color: #555;">💰 Cijena:</strong> 
                            <span style="color: #333;">${appointment.price} KM</span>
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(emailContent);
            console.log('Owner notification email sent');
            return true;
        } catch (error) {
            console.error('Failed to send owner notification email:', error);
            return false;
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