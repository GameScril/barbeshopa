const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { formatDateKey, isWorkingDay } = require('./services/availabilityService');

const app = express();
const publicDir = path.join(__dirname, 'public');
const port = process.env.PORT || 3000;

const TIME_ZONE = 'Europe/Belgrade';
const WORK_START_MINUTES = 8 * 60;
const WORK_END_MINUTES = 16 * 60;
const SLOT_STEP_MINUTES = 10;
const NEXT_SLOT_DURATION = 30;

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

function findNextLocalSlot(fromDate = new Date()) {
    const now = new Date(fromDate);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let dayOffset = 0; dayOffset <= 30; dayOffset += 1) {
        const candidateDate = new Date(now);
        candidateDate.setDate(now.getDate() + dayOffset);
        if (!isWorkingDay(candidateDate)) {
            continue;
        }
        const earliestMinutes = dayOffset === 0 ? Math.max(WORK_START_MINUTES, currentMinutes) : WORK_START_MINUTES;
        let slotMinutes = Math.ceil(earliestMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;

        while (slotMinutes + NEXT_SLOT_DURATION <= WORK_END_MINUTES) {
            return {
                date: formatDateKey(candidateDate),
                time: formatDisplayTime(slotMinutes),
                displayDate: formatDisplayDate(candidateDate),
                isToday: dayOffset === 0
            };
        }
    }

    return null;
}

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

app.get('/api/appointments/next-slot', (req, res) => {
    res.json({
        success: true,
        nextSlot: findNextLocalSlot()
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