const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase, testConnection } = require('./db');
const { validateAppointment } = require('./middleware/validate');
const { emailService } = require('./services/emailService');
const { calendarService } = require('./services/calendarService');
const { findNextAvailableSlot, formatDateKey, isWorkingDay } = require('./services/availabilityService');

const app = express();

const TIME_ZONE = 'Europe/Belgrade';
const WORK_START_MINUTES = 8 * 60;
const WORK_END_MINUTES = 16 * 60;
const SLOT_STEP_MINUTES = 10;
const NEXT_SLOT_DURATION = 30;
const NEXT_SLOT_HORIZON_DAYS = 30;

process.env.TZ = 'Europe/Belgrade';

function formatDisplayDate(date) {
    const displayDate = new Intl.DateTimeFormat('bs-BA', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(date);

    return displayDate.charAt(0).toUpperCase() + displayDate.slice(1);
}

function formatDisplayTime(minutes) {
    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
}

function groupBookedSlots(rows) {
    return rows.reduce((accumulator, row) => {
        if (!accumulator.has(row.date)) {
            accumulator.set(row.date, []);
        }

        const [hour, minute] = row.time.split(':').map(Number);
        accumulator.get(row.date).push({
            startMinutes: hour * 60 + minute,
            endMinutes: hour * 60 + minute + Number(row.duration || 0)
        });

        return accumulator;
    }, new Map());
}

function findNextSlotFromGroupedBookings(bookingsByDate, fromDate = new Date()) {
    const now = new Date(fromDate);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let dayOffset = 0; dayOffset <= NEXT_SLOT_HORIZON_DAYS; dayOffset += 1) {
        const candidateDate = new Date(now);
        candidateDate.setDate(now.getDate() + dayOffset);

        if (!isWorkingDay(candidateDate)) {
            continue;
        }

        const dateKey = formatDateKey(candidateDate);
        const bookedSlots = bookingsByDate.get(dateKey) || [];
        const earliestMinutes = dayOffset === 0 ? Math.max(WORK_START_MINUTES, currentMinutes) : WORK_START_MINUTES;
        let slotMinutes = Math.ceil(earliestMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;

        while (slotMinutes + NEXT_SLOT_DURATION <= WORK_END_MINUTES) {
            const slotEnd = slotMinutes + NEXT_SLOT_DURATION;
            const hasConflict = bookedSlots.some(booking => slotMinutes < booking.endMinutes && slotEnd > booking.startMinutes);

            if (!hasConflict) {
                return {
                    date: dateKey,
                    time: formatDisplayTime(slotMinutes),
                    displayDate: formatDisplayDate(candidateDate),
                    isToday: dayOffset === 0
                };
            }

            slotMinutes += SLOT_STEP_MINUTES;
        }
    }

    return null;
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initializeDatabase().catch(console.error);

// Debug routes
app.get('/api/debug-env', (req, res) => {
    const emailConfigured = !!process.env.SMTP_HOST
        ? !!process.env.SMTP_USER && !!process.env.SMTP_PASS
        : !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS;

    const calendarConfigured = !!process.env.GOOGLE_CLIENT_ID &&
        !!process.env.GOOGLE_CLIENT_SECRET &&
        !!process.env.GOOGLE_REDIRECT_URI &&
        !!process.env.GOOGLE_REFRESH_TOKEN;

    res.json({
        email_configured: emailConfigured && !!process.env.SHOP_EMAIL,
        calendar_configured: calendarConfigured,
        shop_info_configured: !!process.env.SHOP_ADDRESS && !!process.env.SHOP_NAME
    });
});

app.get('/api/google/auth-url', (req, res) => {
    const authUrl = calendarService.getAuthUrl();

    if (!authUrl) {
        return res.status(400).json({
            success: false,
            error: 'Google Calendar integration is not configured'
        });
    }

    res.json({
        success: true,
        authUrl
    });
});

app.get('/api/google/oauth2callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'Missing authorization code'
        });
    }

    const tokenResult = await calendarService.exchangeCodeForToken(code);

    if (!tokenResult.success) {
        return res.status(500).json({
            success: false,
            error: tokenResult.error,
            details: tokenResult.details || null
        });
    }

    res.json({
        success: true,
        message: 'Authorization successful. Copy the refresh token into Railway or your .env file.',
        refreshToken: tokenResult.refreshToken,
        accessToken: tokenResult.accessToken
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

    console.log('\n=== Fetching Appointments ===');
    console.log('Requested date:', date);

    try {
        connection = await pool.getConnection();
        
        // Get all appointments for the specified date
        const [rows] = await connection.execute(
            'SELECT DATE_FORMAT(date, "%Y-%m-%d") as date, TIME_FORMAT(time, "%H:%i") as time, duration FROM appointments WHERE date = ?',
            [date]
        );
        
        console.log('Database query results:', rows);

        // Format the results
        const bookedSlots = rows.map(row => {
            console.log(`Processing booking for ${row.date} at ${row.time} for ${row.duration} minutes`);
            return {
                time: row.time,
                duration: parseInt(row.duration),
                date: row.date
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

app.get('/api/appointments/next-slot', async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        const startDate = formatDateKey(new Date());
        const endDate = formatDateKey(new Date(Date.now() + NEXT_SLOT_HORIZON_DAYS * 24 * 60 * 60 * 1000));

        const [rows] = await connection.execute(
            'SELECT DATE_FORMAT(date, "%Y-%m-%d") as date, TIME_FORMAT(time, "%H:%i") as time, duration FROM appointments WHERE date BETWEEN ? AND ? ORDER BY date ASC, time ASC',
            [startDate, endDate]
        );

        const nextSlot = findNextSlotFromGroupedBookings(groupBookedSlots(rows));

        res.json({
            success: true,
            nextSlot
        });
    } catch (error) {
        console.error('Error fetching next available slot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch next available slot',
            nextSlot: null
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
                req.serviceLabel,
                req.servicePrice,
                req.body.date,
                req.body.time,
                req.serviceDuration,
                req.body.name,
                req.body.phone
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            appointment: {
                ...req.body,
                id: result.insertId
            }
        });

        void (async () => {
            let calendarResult = { success: false, error: 'Calendar not attempted' };

            try {
                const serviceName = req.serviceLabel;

                calendarResult = await calendarService.addEvent({
                    startDateTime: appointmentDate,
                    duration: req.serviceDuration,
                    summary: `${serviceName} - ${req.body.name}`,
                    description: `
                    Klijent: ${req.body.name}
                    Telefon: ${req.body.phone}
                    Usluga: ${serviceName}
                    Cijena: ${req.servicePrice} KM
                `,
                    timeZone: 'Europe/Belgrade'
                });

                if (!calendarResult.success) {
                    console.error('Failed to create Google Calendar event:', calendarResult.error);
                }
            } catch (calendarError) {
                console.error('Google Calendar error:', calendarError);
            }

            try {
                const emailResult = await emailService.sendOwnerNotification({
                    ...req.body,
                    id: result.insertId,
                    duration: req.serviceDuration,
                    calendarLink: calendarResult.htmlLink
                });

                if (!emailResult.success) {
                    console.error('Failed to send email notification:', emailResult.error);
                }
            } catch (emailError) {
                console.error('Email/Calendar error:', emailError);
            }
        })().catch(notificationError => {
            console.error('Post-booking notification error:', notificationError);
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