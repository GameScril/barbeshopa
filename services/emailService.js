const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendConfirmationEmail = async (appointment) => {
    // Email to customer
    const customerMailOptions = {
        from: process.env.EMAIL_USER,
        to: appointment.email,
        subject: 'Royal Barbershop - Potvrda Rezervacije',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #D4AF37;">Vaša rezervacija je potvrđena!</h2>
                <p>Poštovani/a ${appointment.name},</p>
                <p>Vaša rezervacija je uspješno kreirana.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #D4AF37;">Detalji rezervacije:</h3>
                    <p><strong>Usluga:</strong> ${getServiceName(appointment.service)}</p>
                    <p><strong>Datum:</strong> ${new Date(appointment.date).toLocaleDateString('sr-RS', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</p>
                    <p><strong>Vrijeme:</strong> ${appointment.time}</p>
                    <p><strong>Cijena:</strong> ${appointment.price} KM</p>
                </div>

                <p><strong>Lokacija:</strong> ${process.env.SHOP_ADDRESS}</p>
                
                <p style="color: #666; font-size: 0.9em;">
                    Za otkazivanje ili promjenu termina, molimo vas da nas kontaktirate na broj telefona: 065/018-977
                </p>
            </div>
        `
    };

    // Email to shop owner
    const shopMailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.SHOP_EMAIL,
        subject: 'Nova Rezervacija',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #D4AF37;">Nova Rezervacija</h2>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3>Informacije o klijentu:</h3>
                    <p><strong>Ime:</strong> ${appointment.name}</p>
                    <p><strong>Telefon:</strong> ${appointment.phone}</p>
                    <p><strong>Email:</strong> ${appointment.email}</p>
                    <p><strong>Usluga:</strong> ${getServiceName(appointment.service)}</p>
                    <p><strong>Datum:</strong> ${new Date(appointment.date).toLocaleDateString('sr-RS', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</p>
                    <p><strong>Vrijeme:</strong> ${appointment.time}</p>
                    <p><strong>Cijena:</strong> ${appointment.price} KM</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(customerMailOptions);
        await transporter.sendMail(shopMailOptions);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
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

module.exports = { sendConfirmationEmail }; 