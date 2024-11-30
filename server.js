const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase } = require('./db');
const { validateAppointment } = require('./middleware/validate');
const { calendarService } = require('./src/calendar/CalendarService.js');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initializeDatabase().catch(console.error);

app.post('/api/appointments', validateAppointment, async (req, res) => {
    try {
        // Check for existing appointment
        const [existing] = await pool.execute(
            'SELECT * FROM appointments WHERE date = ? AND time = ?',
            [req.body.date, req.body.time]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Ovaj termin je već rezervisan'
            });
        }

        // Calculate start and end times
        const [hours, minutes] = req.body.time.split(':');
        const startDateTime = new Date(req.body.date);
        startDateTime.setHours(parseInt(hours), parseInt(minutes), 0);
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + 30);

        // Add to calendar
        try {
            await calendarService.addEvent({
                startDateTime,
                endDateTime,
                summary: `Royal Barbershop - ${getServiceName(req.body.service)}`,
                description: `Client: ${req.body.name}\nPhone: ${req.body.phone}\nEmail: ${req.body.email}`,
                location: process.env.SHOP_ADDRESS,
                attendees: [{ email: process.env.SHOP_EMAIL }]
            });
        } catch (calendarError) {
            console.error('Calendar event creation failed:', calendarError);
        }

        // Save appointment to database
        try {
            const [result] = await pool.execute(
                'INSERT INTO appointments (service, price, date, time, name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    req.body.service,
                    req.body.price,
                    req.body.date,
                    req.body.time,
                    req.body.name,
                    req.body.phone,
                    req.body.email
                ]
            );

            // Create response with a safe fallback for id
            const appointmentData = {
                ...req.body,
                id: result && result.insertId ? result.insertId : Date.now() // Use timestamp as fallback ID
            };

            res.json({ 
                success: true, 
                appointment: appointmentData
            });

        } catch (dbError) {
            console.error('Database error:', dbError);
            throw dbError;
        }

    } catch (error) {
        console.error('Appointment creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Greška pri kreiranju rezervacije' 
        });
    }
});

app.get('/api/appointments', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date parameter is required'
            });
        }

        const [appointments] = await pool.execute(
            'SELECT * FROM appointments WHERE date = ?',
            [date]
        );
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
});

app.get('/api/test-db', async (req, res) => {
    try {
        // Try to execute a simple query
        const [result] = await pool.execute('SELECT 1');
        res.json({
            success: true,
            message: 'Database connection successful',
            mysqlHost: process.env.MYSQLHOST,
            database: process.env.MYSQLDATABASE
        });
    } catch (error) {
        console.error('Database connection test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            mysqlHost: process.env.MYSQLHOST,
            database: process.env.MYSQLDATABASE
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function getServiceName(service) {
    const services = {
        'brada': 'Brijanje',
        'kosa': 'Šišanje',
        'bradaikosa': 'Brijanje i Šišanje'
    };
    return services[service] || service;
} 