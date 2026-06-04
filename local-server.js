const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname, 'public');
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(publicDir));

app.get('/api/debug-env', (req, res) => {
    res.json({
        local_mode: true,
        email_configured: false,
        calendar_configured: false,
        shop_info_configured: true
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

app.get('/api/test-db', (req, res) => {
    res.json({
        success: true,
        message: 'Local preview mode does not use a database.',
        localMode: true
    });
});

app.get('/api/test-db-connection', (req, res) => {
    res.json({
        success: true,
        message: 'Local preview mode does not use a database.',
        localMode: true
    });
});

app.get('/api/appointments/month', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

app.get('/api/appointments/slots/:date', (req, res) => {
    res.json({
        success: true,
        bookedSlots: []
    });
});

app.post('/api/appointments', (req, res) => {
    res.json({
        success: true,
        appointment: {
            id: Date.now(),
            ...req.body
        }
    });
});

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(publicDir, 'index.html'));
    } else {
        res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Local preview server is running on http://localhost:${port}`);
    console.log('Open / for the home page and /reservation.html for the booking page.');
});