const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase } = require('./db');
const { validateAppointment } = require('./middleware/validate');
const { calendarService } = require('./src/calendar/CalendarService.js');
const { emailService } = require('./services/emailService');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initializeDatabase().catch(console.error);

app.post('/api/appointments', validateAppointment, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Check for existing appointment
            const [existing] = await connection.execute(
                'SELECT * FROM appointments WHERE date = ? AND time = ? FOR UPDATE',
                [req.body.date, req.body.time]
            );

            if (existing.length > 0) {
                await connection.rollback();
                connection.release();
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
            const calendarResult = await calendarService.addEvent({
                startDateTime,
                endDateTime,
                summary: `Royal Barbershop - ${getServiceName(req.body.service)}`,
                description: `Client: ${req.body.name}\nPhone: ${req.body.phone}\nEmail: ${req.body.email}`,
                location: process.env.SHOP_ADDRESS,
                attendees: [{ email: process.env.SHOP_EMAIL, name: 'Royal Barbershop' }]
            });
            
            let calendarEventId = null;
            if (calendarResult && calendarResult.success) {
                calendarEventId = calendarResult.eventId;
            }

            // Save appointment to database
            const [result] = await connection.execute(
                'INSERT INTO appointments (service, price, date, time, name, phone, email, calendarEventId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    req.body.service,
                    req.body.price,
                    req.body.date,
                    req.body.time,
                    req.body.name,
                    req.body.phone,
                    req.body.email,
                    calendarEventId
                ]
            );

            // Send single email notification with calendar event info
            await emailService.sendOwnerNotification({
                ...req.body,
                calendarEventId
            });

            await connection.commit();
            connection.release();

            res.json({ 
                success: true, 
                appointment: {
                    ...req.body,
                    id: result.insertId,
                    calendarEventId
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Appointment creation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Greška pri kreiranju rezervacije'
        });
    }
});

app.get('/api/appointments', async (req, res) => {
    try {
        const date = req.query.date;
        const [appointments] = await pool.execute(
            'SELECT time FROM appointments WHERE date = ?',
            [date]
        );
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error' });
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add this new endpoint after your other routes
app.get('/api/test-appointments', async (req, res) => {
    try {
        // Try to insert a test appointment
        const testAppointment = {
            service: 'kosa',
            price: 10.00,
            date: '2024-03-07',
            time: '10:00',
            name: 'Test User',
            phone: '1234567890',
            email: 'test@test.com'
        };

        const [result] = await pool.execute(
            'INSERT INTO appointments (service, price, date, time, name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                testAppointment.service,
                testAppointment.price,
                testAppointment.date,
                testAppointment.time,
                testAppointment.name,
                testAppointment.phone,
                testAppointment.email
            ]
        );

        res.json({
            success: true,
            message: 'Test appointment created successfully',
            appointmentId: result.insertId
        });
    } catch (error) {
        console.error('Test appointment creation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Use PORT provided by Railway or default to 3000
const port = process.env.PORT || 3000;

// Listen on the correct host and port
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

function getServiceName(service) {
    const services = {
        'brada': 'Brijanje',
        'kosa': 'Šišanje',
        'bradaikosa': 'Brijanje i Šišanje'
    };
    return services[service] || service;
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

console.log('Public directory:', path.join(__dirname, 'public')); 