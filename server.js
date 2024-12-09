const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase, testConnection } = require('./db');
const { validateAppointment } = require('./middleware/validate');
const { emailService } = require('./services/emailService');
const { calendarService } = require('./services/calendarService');

const app = express();

process.env.TZ = 'Europe/Belgrade';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initializeDatabase().catch(console.error);

// Debug routes
app.get('/api/debug-env', (req, res) => {
    res.json({
        email_configured: !!process.env.EMAIL_USER && !!process.env.SHOP_EMAIL,
        calendar_configured: !!process.env.GOOGLE_CLIENT_ID && 
                           !!process.env.GOOGLE_CLIENT_SECRET && 
                           !!process.env.GOOGLE_REFRESH_TOKEN,
        shop_info_configured: !!process.env.SHOP_ADDRESS && !!process.env.SHOP_NAME
    });
});

app.get('/api/debug-date', (req, res) => {
    const testDate = new Date();
    res.json({
        current: {
            iso: testDate.toISOString(),
            locale: testDate.toLocaleString('sr-Latn', { timeZone: 'Europe/Belgrade' }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        env: {
            TZ: process.env.TZ,
            NODE_TZ: process.env.NODE_TZ
        }
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
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

app.get('/api/test-db-connection', async (req, res) => {
    try {
        const isConnected = await testConnection();
        if (isConnected) {
            res.json({
                success: true,
                message: 'Database connection successful',
                config: {
                    host: process.env.MYSQLHOST,
                    user: process.env.MYSQLUSER,
                    database: process.env.MYSQLDATABASE,
                    port: process.env.MYSQLPORT
                }
            });
        } else {
            throw new Error('Connection test failed');
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            config: {
                host: process.env.MYSQLHOST,
                user: process.env.MYSQLUSER,
                database: process.env.MYSQLDATABASE,
                port: process.env.MYSQLPORT
            }
        });
    }
});

// API Routes
app.get('/api/appointments/month', async (req, res) => {
    const { start, end } = req.query;
    let connection;
    
    if (!start || !end) {
        return res.status(400).json({
            success: false,
            error: 'Start and end dates are required',
            data: []
        });
    }

    try {
        connection = await pool.getConnection();
        console.log('Fetching appointments between:', start, 'and', end);
        
        const [rows] = await connection.execute(
            'SELECT DISTINCT DATE(date) as date FROM appointments WHERE date BETWEEN ? AND ?',
            [start, end]
        );

        const formattedDates = rows.map(row => {
            const date = new Date(row.date);
            return date.toISOString().split('T')[0];
        });

        res.json({
            success: true,
            data: formattedDates
        });

    } catch (error) {
        console.error('Error fetching monthly reservations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reservations',
            data: []
        });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/appointments/slots/:date', async (req, res) => {
    const { date } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        // Get all appointments for the specified date with more precise time format
        const [rows] = await connection.execute(
            `SELECT 
                TIME_FORMAT(time, '%H:%i') as time,
                duration,
                TIME_FORMAT(
                    ADDTIME(time, SEC_TO_TIME(duration * 60)),
                    '%H:%i'
                ) as end_time
            FROM appointments 
            WHERE date = ? 
            ORDER BY time`,
            [date]
        );
        
        console.log('Found appointments for date:', date, rows);
        
        // Make sure we're returning the data in the correct format with start and end times
        const bookedSlots = rows.map(row => {
            const [startHours, startMinutes] = row.time.split(':').map(Number);
            const [endHours, endMinutes] = row.end_time.split(':').map(Number);
            
            return {
                time: row.time,
                duration: parseInt(row.duration),
                startMinutes: startHours * 60 + startMinutes,
                endMinutes: endHours * 60 + endMinutes
            };
        });

        console.log('Formatted booked slots:', bookedSlots);
        
        res.json({ 
            success: true,
            bookedSlots: bookedSlots
        });
    } catch (error) {
        console.error('Error fetching booked slots:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            bookedSlots: [] 
        });
    } finally {
        if (connection) connection.release();
    }
});

// POST route for creating appointments
app.post('/api/appointments', validateAppointment, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log('Creating appointment:', {
            body: req.body,
            serviceDuration: req.serviceDuration,
            connection: !!connection
        });

        const appointmentDate = new Date(`${req.body.date}T${req.body.time}`);
        const endTime = new Date(appointmentDate.getTime() + req.serviceDuration * 60000);
        const endTimeString = endTime.toTimeString().slice(0, 5);

        const [overlapping] = await connection.execute(
            `SELECT * FROM appointments 
             WHERE date = ? 
             AND ((time <= ? AND ADDTIME(time, SEC_TO_TIME(duration * 60)) > ?) 
                  OR (time < ? AND ADDTIME(time, SEC_TO_TIME(duration * 60)) >= ?))
             FOR UPDATE`,
            [req.body.date, req.body.time, req.body.time, endTimeString, endTimeString]
        );

        if (overlapping.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                error: 'Ovaj termin se preklapa sa postojećom rezervacijom'
            });
        }

        const [result] = await connection.execute(
            'INSERT INTO appointments (service, price, date, time, duration, name, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                req.body.service,
                req.body.price,
                req.body.date,
                req.body.time,
                req.serviceDuration,
                req.body.name,
                req.body.phone
            ]
        );

        await connection.commit();

        try {
            const emailResult = await emailService.sendOwnerNotification({
                ...req.body,
                id: result.insertId,
                duration: req.serviceDuration
            });

            if (!emailResult.success) {
                console.error('Failed to send email notification:', emailResult.error);
            }
        } catch (emailError) {
            console.error('Email/Calendar error:', emailError);
        }

        res.json({
            success: true,
            appointment: {
                ...req.body,
                id: result.insertId
            }
        });

    } catch (error) {
        console.error('Appointment creation error:', error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        res.status(500).json({
            success: false,
            error: 'Došlo je do greške prilikom kreiranja rezervacije'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Catch-all route - MUST BE LAST
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
}); 