const validateAppointment = (req, res, next) => {
    const { service, price, date, time, name, phone, email } = req.body;

    // Validate service type with Serbian names
    const validServices = ['brada', 'kosa', 'bradaikosa'];
    if (!validServices.includes(service)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Nevalidna usluga' 
        });
    }

    // Validate price with Serbian service names
    const validPrices = {
        'brada': 4,
        'kosa': 8,
        'bradaikosa': 12
    };
    if (price != validPrices[service]) {
        return res.status(400).json({ 
            success: false, 
            error: 'Nevalidna cijena za izabranu uslugu' 
        });
    }

    // Validate date
    const appointmentDate = new Date(date);
    const today = new Date();
    if (appointmentDate < today) {
        return res.status(400).json({ 
            success: false, 
            error: 'Ne možete rezervisati termin u prošlosti' 
        });
    }

    // Validate time format and business hours
    const [hours, minutes] = time.split(':');
    const numHours = parseInt(hours);
    const numMinutes = parseInt(minutes);

    // Check if time is within business hours (8:00 - 16:00)
    if (numHours < 8 || numHours > 15 || (numHours === 15 && numMinutes > 30)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Van radnog vremena (08:00 - 16:00)' 
        });
    }

    // Check if minutes are either 00 or 30
    if (numMinutes !== 0 && numMinutes !== 30) {
        return res.status(400).json({ 
            success: false, 
            error: 'Termini su dostupni svakih 30 minuta' 
        });
    }

    // Validate name
    if (!name || name.length < 2) {
        return res.status(400).json({ 
            success: false, 
            error: 'Ime je obavezno i mora imati najmanje 2 karaktera' 
        });
    }

    // Validate phone number
    const phoneRegex = /^[0-9]{9,12}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Neispravan format broja telefona' 
        });
    }

    // Validate email
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Neispravna email adresa' 
        });
    }

    next();
};

module.exports = { validateAppointment }; 