const { pool } = require('../db');

const serviceConfig = {
    pranje: { label: 'Pranje', duration: 10, price: 5 },
    depilacija: { label: 'Depilacija', duration: 10, price: 5 },
    ciscenjeusiju: { label: 'Čišćenje ušiju', duration: 10, price: 10 },
    sisanje: { label: 'Šišanje', duration: 20, price: 13 },
    brada: { label: 'Brada', duration: 10, price: 7 },
    sisanjeibrada: { label: 'Šišanje i brada', duration: 30, price: 20 }
};

const validateAppointment = async (req, res, next) => {
    const { service, services, date, time, name, phone } = req.body;
    
    // Basic validation
    if ((!service && !services) || !date || !time || !name || !phone) {
        return res.status(400).json({
            success: false,
            error: 'Sva polja su obavezna'
        });
    }
    
    const selectedServices = Array.isArray(services)
        ? services
        : String(service || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

    if (selectedServices.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Sva polja su obavezna'
        });
    }

    const unknownService = selectedServices.find(item => !serviceConfig[item]);
    if (unknownService) {
        return res.status(400).json({
            success: false,
            error: `Nepoznata usluga: ${unknownService}`
        });
    }

    const phoneDigitsOnly = String(phone).replace(/\D/g, '');

    if (!/^\d{9}$/.test(phoneDigitsOnly)) {
        return res.status(400).json({
            success: false,
            error: 'Broj mobitela mora imati tačno 9 cifara'
        });
    }

    req.body.phone = phoneDigitsOnly;

    const duration = selectedServices.reduce((total, item) => total + serviceConfig[item].duration, 0);
    const totalPrice = selectedServices.reduce((total, item) => total + serviceConfig[item].price, 0);
    const serviceLabel = selectedServices.map(item => serviceConfig[item].label).join(' + ');
    
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
        req.selectedServices = selectedServices;
        req.serviceDuration = duration;
        req.servicePrice = totalPrice;
        req.serviceLabel = serviceLabel;
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