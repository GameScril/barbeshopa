const { pool } = require('../db');

const serviceDurations = {
    'brada': 10,    // Brijanje - 10 minutes
    'kosa': 20,     // Šišanje - 20 minutes
    'bradaikosa': 30 // Both - 30 minutes
};

const validateAppointment = async (req, res, next) => {
    const { service, date, time } = req.body;
    
    // Validate business hours
    const [hours, minutes] = time.split(':').map(Number);
    const requestedTimeInMinutes = hours * 60 + minutes;
    
    const startTime = 8 * 60;  // 8:00 AM in minutes
    const endTime = 16 * 60;   // 4:00 PM in minutes
    
    // Get service duration
    const durations = {
        'brada': 10,
        'kosa': 20,
        'bradaikosa': 30
    };
    const duration = durations[service] || 20;
    
    // Check if appointment starts and ends within business hours
    if (requestedTimeInMinutes < startTime || 
        requestedTimeInMinutes + duration > endTime) {
        return res.status(400).json({
            success: false,
            error: 'Termin mora biti između 08:00 i 16:00'
        });
    }
    
    // Add duration to the request object
    req.serviceDuration = duration;
    
    // Check if the time slot is available
    const connection = await pool.getConnection();
    try {
        const [existingBookings] = await connection.execute(
            'SELECT time, duration FROM appointments WHERE date = ?',
            [date]
        );
        
        // Convert requested time to minutes for comparison
        const requestedTimeInMinutes = convertTimeToMinutes(time);
        const requestedEndTime = requestedTimeInMinutes + duration;
        
        // Check for conflicts with existing bookings
        const hasConflict = existingBookings.some(booking => {
            const bookingStart = convertTimeToMinutes(booking.time);
            const bookingEnd = bookingStart + booking.duration;
            
            return (requestedTimeInMinutes < bookingEnd && requestedEndTime > bookingStart);
        });
        
        if (hasConflict) {
            return res.status(400).json({
                success: false,
                error: 'Izabrani termin nije dostupan'
            });
        }
        
        next();
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Došlo je do greške prilikom validacije termina'
        });
    } finally {
        connection.release();
    }
};

function convertTimeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

module.exports = { validateAppointment }; 