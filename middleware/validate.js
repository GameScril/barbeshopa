const { pool } = require('../db');

const serviceDurations = {
    'brada': 10,    // Brijanje - 10 minutes
    'kosa': 20,     // Šišanje - 20 minutes
    'bradaikosa': 30 // Both - 30 minutes
};

const validateAppointment = async (req, res, next) => {
    const { service, date, time, name, phone } = req.body;
    
    // Basic validation
    if (!service || !date || !time || !name || !phone) {
        return res.status(400).json({
            success: false,
            error: 'Sva polja su obavezna'
        });
    }
    
    // Get service duration
    const durations = {
        'brada': 10,
        'kosa': 20,
        'bradaikosa': 30
    };
    const duration = durations[service] || 20;
    
    // Convert requested time to minutes for comparison
    const [hours, minutes] = time.split(':').map(Number);
    const requestedTimeInMinutes = hours * 60 + minutes;
    const requestedEndTime = requestedTimeInMinutes + duration;
    
    // Check if the time slot is available
    const connection = await pool.getConnection();
    try {
        const [existingBookings] = await connection.execute(
            'SELECT TIME_FORMAT(time, "%H:%i") as time, duration FROM appointments WHERE date = ?',
            [date]
        );
        
        // Check for conflicts with existing bookings
        const hasConflict = existingBookings.some(booking => {
            const [bookingHours, bookingMinutes] = booking.time.split(':').map(Number);
            const bookingStart = bookingHours * 60 + bookingMinutes;
            const bookingEnd = bookingStart + parseInt(booking.duration);
            
            // Add 5-minute buffer before and after
            const bookingStartWithBuffer = bookingStart - 5;
            const bookingEndWithBuffer = bookingEnd + 5;
            
            return !(requestedTimeInMinutes >= bookingEndWithBuffer || 
                    requestedEndTime <= bookingStartWithBuffer);
        });
        
        if (hasConflict) {
            return res.status(400).json({
                success: false,
                error: 'Izabrani termin nije dostupan'
            });
        }
        
        // Add duration to the request object
        req.serviceDuration = duration;
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