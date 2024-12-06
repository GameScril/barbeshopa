const API_BASE_URL = window.location.origin; // This will use the same domain as where the app is hosted

document.addEventListener('DOMContentLoaded', () => {
    // Add this at the start to check if styles are loaded
    const styles = getComputedStyle(document.body);
    console.log('Styles loaded:', {
        bodyBackground: styles.backgroundColor,
        bodyFont: styles.fontFamily
    });

    // First, verify all elements exist
    const serviceCards = document.querySelectorAll('.service-card');
    const timeSlots = document.getElementById('time-slots');
    const bookButton = document.getElementById('book-appointment');
    const dateDisplay = document.getElementById('selected-date');
    const calendarContainer = document.getElementById('calendar-container');
    const modal = document.getElementById('notification-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalClose = document.querySelector('.modal-close');

    // Debug log to verify elements are found
    console.log('Elements found:', {
        serviceCards: serviceCards.length,
        timeSlots: !!timeSlots,
        bookButton: !!bookButton,
        dateDisplay: !!dateDisplay,
        calendarContainer: !!calendarContainer,
        modal: !!modal,
        modalTitle: !!modalTitle,
        modalMessage: !!modalMessage,
        modalClose: !!modalClose
    });

    let currentDate = new Date();
    let selectedDate = null;

    // Add this CSS class for reserved dates
    const calendarStyle = document.createElement('style');
    calendarStyle.textContent = `
        .calendar-dates div.has-reservations::after {
            content: '×';
            position: absolute;
            color: #ff4444;
            font-weight: bold;
            font-size: 1.2em;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        .calendar-dates div {
            position: relative;
        }
    `;
    document.head.appendChild(calendarStyle);

    async function createCalendar(date) {
        if (!calendarContainer) {
            console.error('Calendar container not found!');
            return;
        }

        // Fetch all reservations for this month
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const formattedStart = startOfMonth.toISOString().split('T')[0];
        const formattedEnd = endOfMonth.toISOString().split('T')[0];
        
        let reservedDates = new Set();
        try {
            const response = await fetch(`${API_BASE_URL}/api/appointments/month?start=${formattedStart}&end=${formattedEnd}`);
            const reservations = await response.json();
            reservedDates = new Set(reservations.map(r => r.date));
        } catch (error) {
            console.error('Error fetching monthly reservations:', error);
        }

        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const startingDay = (firstDay.getDay() + 6) % 7;
        
        calendarContainer.innerHTML = `
            <div class="calendar-header">
                <button id="prev-month">&lt;</button>
                <h3>${date.toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' })}</h3>
                <button id="next-month">&gt;</button>
            </div>
            <div class="calendar-days">
                <div>Pon</div><div>Uto</div><div>Sri</div><div>Čet</div>
                <div>Pet</div><div>Sub</div><div>Ned</div>
            </div>
            <div class="calendar-dates"></div>
        `;

        const datesContainer = calendarContainer.querySelector('.calendar-dates');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            datesContainer.appendChild(emptyDay);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateCell = document.createElement('div');
            const dateObj = new Date(date.getFullYear(), date.getMonth(), day);
            const formattedDate = dateObj.toISOString().split('T')[0];
            
            dateCell.textContent = day;

            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            const now = new Date();
            const isToday = dateObj.toDateString() === now.toDateString();
            const isAfterBusinessHours = now.getHours() >= 16;
            const isPast = dateObj < now || (isToday && isAfterBusinessHours);

            if (reservedDates.has(formattedDate)) {
                dateCell.classList.add('has-reservations');
            }

            if (isPast || isWeekend) {
                dateCell.classList.add('disabled');
            } else {
                dateCell.addEventListener('click', () => selectDate(dateObj, dateCell));
            }

            if (isToday) {
                dateCell.classList.add('today');
            }

            datesContainer.appendChild(dateCell);
        }

        document.getElementById('prev-month').addEventListener('click', () => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
            if (newDate.getMonth() >= new Date().getMonth() || 
                newDate.getFullYear() > new Date().getFullYear()) {
                currentDate = newDate;
                handleMonthChange();
                createCalendar(currentDate);
            }
        });

        document.getElementById('next-month').addEventListener('click', () => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
            const threeMonthsFromNow = new Date();
            threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
            
            if (newDate <= threeMonthsFromNow) {
                currentDate = newDate;
                handleMonthChange();
                createCalendar(currentDate);
            }
        });
    }

    function selectDate(dateObj, dateCell) {
        // Add validation for weekends and past dates
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateObj < today) {
            showNotification('Upozorenje', 'Ne možete izabrati datum u prošlosti');
            return;
        }

        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            showNotification('Upozorenje', 'Ne radimo vikendom');
            return;
        }

        document.querySelectorAll('.calendar-dates div').forEach(div => {
            div.classList.remove('selected');
        });
        
        dateCell.classList.add('selected');
        selectedDate = dateObj;
        
        // Format date in Serbian
        dateDisplay.textContent = dateObj.toLocaleDateString('sr-Latn', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Europe/Belgrade'
        });
        
        dateDisplay.classList.add('visible');
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.style.display = 'grid'; // Ensure time slots are visible
        generateTimeSlots(dateObj);
    }

    async function generateTimeSlots(date) {
        timeSlots.innerHTML = '';
        const startTime = 8; // 8 AM
        const endTime = 16; // 4 PM

        try {
            const formattedDate = date.toISOString().split('T')[0];
            const response = await fetch(`${API_BASE_URL}/api/appointments?date=${formattedDate}`);
            const bookedAppointments = await response.json();
            
            // Create a map of all blocked time slots
            const blockedTimes = new Set();
            bookedAppointments.forEach(apt => {
                const startTime = new Date(`${apt.date}T${apt.time}`);
                const duration = apt.duration || 30; // fallback to 30 if not set
                
                // Block all slots within the appointment duration
                for (let i = 0; i < duration; i += 10) {
                    const slotTime = new Date(startTime.getTime() + i * 60000);
                    blockedTimes.add(slotTime.toTimeString().slice(0, 5));
                }
            });

            // Get currently selected service
            const selectedService = document.querySelector('.service-card.selected');
            const serviceDurations = {
                'brada': 10,    // Brijanje - 10 minutes
                'kosa': 20,     // Šišanje - 20 minutes
                'bradaikosa': 30 // Both - 30 minutes
            };

            // Generate time slots based on service duration
            for (let hour = startTime; hour < endTime; hour++) {
                for (let minute = 0; minute < 60; minute += 10) {
                    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const timeSlot = document.createElement('div');
                    timeSlot.className = 'time-slot';
                    timeSlot.textContent = timeString;

                    // Check if this slot would overlap with any booked appointments
                    let isBlocked = false;
                    const slotStartTime = new Date(`${formattedDate}T${timeString}`);
                    const duration = selectedService ? serviceDurations[selectedService.dataset.service] : 30;
                    
                    for (let i = 0; i < duration; i += 10) {
                        const checkTime = new Date(slotStartTime.getTime() + i * 60000);
                        const checkTimeString = checkTime.toTimeString().slice(0, 5);
                        if (blockedTimes.has(checkTimeString)) {
                            isBlocked = true;
                            break;
                        }
                    }

                    if (isBlocked) {
                        timeSlot.classList.add('booked');
                    } else {
                        timeSlot.addEventListener('click', function() {
                            document.querySelectorAll('.time-slot').forEach(ts => 
                                ts.classList.remove('selected'));
                            this.classList.add('selected');
                        });
                    }
                    
                    timeSlots.appendChild(timeSlot);
                }
            }
        } catch (error) {
            console.error('Error fetching booked appointments:', error);
            showNotification('Greška', 'Greška pri učitavanju termina');
        }
    }

    // Add this function to update time slots after booking
    async function updateTimeSlotsAfterBooking() {
        if (selectedDate) {
            await generateTimeSlots(selectedDate);
        }
    }

    function generateDefaultTimeSlots() {
        for (let hour = 8; hour < 16; hour++) {
            for (let minutes of ['00', '30']) {
                const timeSlot = document.createElement('div');
                timeSlot.classList.add('time-slot');
                
                const formattedHour = hour.toString().padStart(2, '0');
                const timeString = `${formattedHour}:${minutes}`;
                timeSlot.textContent = timeString;

                timeSlot.addEventListener('click', () => selectTimeSlot(timeSlot));
                timeSlots.appendChild(timeSlot);
            }
        }
    }

    function selectTimeSlot(slot) {
        if (slot.classList.contains('booked')) {
            return; // Don't allow selection of booked slots
        }
        
        // Remove selected class from all time slots
        document.querySelectorAll('.time-slot').forEach(ts => ts.classList.remove('selected'));
        
        // Add selected class to clicked slot
        slot.classList.add('selected');
    }

    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            serviceCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            if (selectedDate) {
                generateTimeSlots(selectedDate); // Regenerate time slots when service changes
            }
        });
    });

    // Initialize calendar at the end
    if (calendarContainer) {
        createCalendar(currentDate);
    } else {
        console.error('Failed to initialize calendar - container not found');
    }

    // Booking submission
    bookButton.addEventListener('click', async () => {
        const selectedTime = document.querySelector('.time-slot.selected');
        
        if (!selectedTime || selectedTime.classList.contains('booked')) {
            showNotification('Upozorenje', 'Molimo izaberite slobodan termin');
            return;
        }

        if (!selectedDate) {
            showNotification('Upozorenje', 'Molimo izaberite datum');
            return;
        }

        const selectedService = document.querySelector('.service-card.selected');
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;

        if (!selectedService || !name || !phone || !email) {
            showNotification('Upozorenje', 'Molimo popunite sva polja');
            return;
        }

        const appointment = {
            service: selectedService.dataset.service,
            price: parseInt(selectedService.dataset.price),
            date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
            time: selectedTime.textContent,
            name: name,
            phone: phone,
            email: email
        };

        console.log('Client-side appointment:', {
            selectedDate: selectedDate,
            localDate: selectedDate.toLocaleDateString(),
            formattedDate: appointment.date,
            time: appointment.time
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(appointment)
            });

            const result = await response.json();
            
            if (result.success) {
                showNotification('Uspjeh', 'Vaša rezervacija je uspješno kreirana!');
                // Clear form
                document.getElementById('name').value = '';
                document.getElementById('phone').value = '';
                document.getElementById('email').value = '';
                selectedDate = null;
                dateDisplay.textContent = '';
                dateDisplay.classList.remove('visible');
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                
                // Regenerate time slots to show newly booked slot
                await updateTimeSlotsAfterBooking();
                
                // Reset calendar
                createCalendar(currentDate);
            } else {
                showNotification('Greška', result.error);
            }
        } catch (error) {
            showNotification('Greška', 'Greška pri rezervaciji: ' + error.message);
        }
    });

    function handleMonthChange() {
        selectedDate = null;
        dateDisplay.textContent = '';
        dateDisplay.classList.remove('visible');
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.classList.remove('visible');
        timeSlotsContainer.innerHTML = '';
    }

    function showNotification(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.add('show');
    }

    modalClose.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    // Update the install button logic
    let deferredPrompt;
    const installButton = document.getElementById('install-button');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        if (installButton) {
            installButton.style.display = 'block';
            installButton.classList.add('show');
        }
    });

    if (installButton) {
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installButton.style.display = 'none';
        });
    }

    // Hide install button if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        if (installButton) {
            installButton.style.display = 'none';
        }
    }
}); 