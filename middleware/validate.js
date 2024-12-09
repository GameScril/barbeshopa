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
        // Get all appointments for the requested date
        const [existingBookings] = await connection.execute(
            'SELECT TIME_FORMAT(time, "%H:%i") as time, duration FROM appointments WHERE date = ?',
            [date]
        );

        console.log('Validating appointment:', {
            date,
            time,
            duration,
            requestedTimeInMinutes,
            requestedEndTime,
            existingBookings
        });
        
        // Check for conflicts with existing bookings
        const hasConflict = existingBookings.some(booking => {
            const [bookingHours, bookingMinutes] = booking.time.split(':').map(Number);
            const bookingStart = bookingHours * 60 + bookingMinutes;
            const bookingEnd = bookingStart + parseInt(booking.duration);
            
            const overlap = (
                (requestedTimeInMinutes >= bookingStart && requestedTimeInMinutes < bookingEnd) ||
                (requestedEndTime > bookingStart && requestedEndTime <= bookingEnd) ||
                (requestedTimeInMinutes <= bookingStart && requestedEndTime >= bookingEnd)
            );

            if (overlap) {
                console.log(`Conflict detected: ${time}-${formatMinutes(requestedEndTime)} overlaps with booking ${booking.time}-${formatMinutes(bookingEnd)}`);
            }

            return overlap;
        });
        
        if (hasConflict) {
            return res.status(409).json({
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

// Helper function to format minutes to HH:MM
function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

module.exports = { validateAppointment }; 