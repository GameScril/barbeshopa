const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase } = require('./db');
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

app.get('/debug-auth', (req, res) => {
    const authUrl = calendarService.getAuthUrl();
    res.send(`
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h1>OAuth Debug Info</h1>
                <pre>${JSON.stringify({
                    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                    client_id_exists: !!process.env.GOOGLE_CLIENT_ID,
                    client_secret_exists: !!process.env.GOOGLE_CLIENT_SECRET,
                    auth_url: authUrl
                }, null, 2)}</pre>
                <a href="${authUrl}" style="display: inline-block; background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px;">
                    Try Auth Flow
                </a>
            </body>
        </html>
    `);
});

app.post('/api/appointments', validateAppointment, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Add validation for date not in past
        const appointmentDate = new Date(`${req.body.date}T${req.body.time}`);
        if (appointmentDate < new Date()) {
            throw new Error('Cannot book appointments in the past');
        }

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

            // Send email with calendar attachment
            const emailResult = await emailService.sendOwnerNotification(req.body);
            
            if (!emailResult.success) {
                throw new Error('Failed to send notification email');
            }

            // Save to database
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
                    emailResult.calendarEventId
                ]
            );

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                appointment: {
                    ...req.body,
                    id: result.insertId,
                    calendarEventId: emailResult.calendarEventId
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Appointment creation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Greška pri kreiranju rezervacije'
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

// Update the OAuth routes
app.get('/auth/google', (req, res) => {
    try {
        const authUrl = calendarService.getAuthUrl();
        console.log('Redirecting to auth URL:', authUrl); // Debug log
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).send('Error setting up authentication');
    }
});

app.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;
    
    // Check for OAuth error response
    if (error) {
        console.error('OAuth error:', error);
        return res.status(400).send(`OAuth error: ${error}`);
    }

    if (!code) {
        console.error('No code received in callback');
        return res.status(400).send('No authorization code received');
    }

    try {
        console.log('Attempting to exchange code for tokens...');
        const { tokens } = await calendarService.oauth2Client.getToken(code);
        
        console.log('Token exchange response:', {
            has_refresh_token: !!tokens.refresh_token,
            has_access_token: !!tokens.access_token,
            expiry_date: tokens.expiry_date,
            scope: tokens.scope
        });

        if (!tokens.access_token) {
            throw new Error('No access token received');
        }

        calendarService.oauth2Client.setCredentials(tokens);
        
        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
                    <h1>Authorization Successful! 🎉</h1>
                    ${tokens.refresh_token ? `
                        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px;">
                            <h2>Your Refresh Token:</h2>
                            <code style="word-break: break-all; background: #fff; padding: 10px; display: block;">
                                ${tokens.refresh_token}
                            </code>
                            <p><strong>Important:</strong> Save this token in your .env file as GOOGLE_REFRESH_TOKEN</p>
                        </div>
                    ` : `
                        <div style="background: #fff3f3; padding: 20px; border-radius: 8px; border: 1px solid #ffcdd2;">
                            <h2 style="color: #d32f2f;">No Refresh Token Received</h2>
                            <p>To get a refresh token:</p>
                            <ol>
                                <li>Go to <a href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
                                <li>Remove access for "${process.env.SHOP_NAME}"</li>
                                <li>Try authenticating again</li>
                            </ol>
                        </div>
                    `}
                    <div style="margin-top: 20px;">
                        <p><strong>Debug Info:</strong></p>
                        <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">
                            Scopes: ${tokens.scope}
                            Expires: ${new Date(tokens.expiry_date).toLocaleString()}
                        </pre>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Token exchange error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(500).send(`
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
                    <h1 style="color: #d32f2f;">Authorization Failed</h1>
                    <div style="background: #fff3f3; padding: 20px; border-radius: 8px; border: 1px solid #ffcdd2;">
                        <h2>Error Details:</h2>
                        <pre style="background: #fff; padding: 10px; overflow-x: auto;">
                            ${error.message}
                            ${error.response?.data ? JSON.stringify(error.response.data, null, 2) : ''}
                        </pre>
                    </div>
                    <div style="margin-top: 20px;">
                        <a href="/auth/google" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                            Try Again
                        </a>
                    </div>
                </body>
            </html>
        `);
    }
});

// Add this route to check your configuration
app.get('/api/check-config', (req, res) => {
    res.json({
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        client_id_length: process.env.GOOGLE_CLIENT_ID?.length || 0,
        client_secret_length: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
        has_refresh_token: !!process.env.GOOGLE_REFRESH_TOKEN
    });
});

// Add this route to test calendar integration
app.get('/api/test-calendar', async (req, res) => {
    try {
        // Create a test event 30 minutes from now
        const startTime = new Date();
        startTime.setMinutes(startTime.getMinutes() + 30);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30);

        const result = await calendarService.addEvent({
            startDateTime: startTime.toISOString(),
            endDateTime: endTime.toISOString(),
            summary: 'Test Appointment',
            description: 'This is a test event',
            location: process.env.SHOP_ADDRESS
        });

        if (result.success) {
            res.json({
                success: true,
                message: 'Test event created successfully',
                eventId: result.eventId
            });
        } else {
            throw new Error(result.error || 'Failed to create test event');
        }
    } catch (error) {
        console.error('Calendar test failed:', error);
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