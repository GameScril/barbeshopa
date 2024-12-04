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
        
        const emailContent = {
            from: process.env.EMAIL_USER,
            to: process.env.SHOP_EMAIL,
            subject: `Nova Rezervacija - ${serviceName}`,
            text: `
Nova rezervacija:

Usluga: ${serviceName}
Datum: ${appointment.date}
Vrijeme: ${appointment.time}
Ime: ${appointment.name}
Telefon: ${appointment.phone}
Email: ${appointment.email}
Cijena: ${appointment.price} KM
            `,
            html: `
                <h2>Nova rezervacija</h2>
                <p><strong>Usluga:</strong> ${serviceName}</p>
                <p><strong>Datum:</strong> ${appointment.date}</p>
                <p><strong>Vrijeme:</strong> ${appointment.time}</p>
                <p><strong>Ime:</strong> ${appointment.name}</p>
                <p><strong>Telefon:</strong> ${appointment.phone}</p>
                <p><strong>Email:</strong> ${appointment.email}</p>
                <p><strong>Cijena:</strong> ${appointment.price} KM</p>
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