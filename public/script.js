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

        // Capitalize first letter of month
        const monthName = date.toLocaleString('sr-Latn', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        const calendarHTML = `
            <div class="calendar-header">
                <button id="prev-month" class="calendar-nav prev">&lt;</button>
                <h3>${capitalizedMonth} ${date.getFullYear()}</h3>
                <button id="next-month" class="calendar-nav next">&gt;</button>
            </div>
            <div class="calendar-days">
                <div>Pon</div>
                <div>Uto</div>
                <div>Sri</div>
                <div>Čet</div>
                <div>Pet</div>
                <div>Sub</div>
                <div>Ned</div>
            </div>
            <div class="calendar-dates"></div>
        `;

        calendarContainer.innerHTML = calendarHTML;

        // Fetch all reservations for this month
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const formattedStart = startOfMonth.toISOString().split('T')[0];
        const formattedEnd = endOfMonth.toISOString().split('T')[0];
        
        let reservedDates = new Set();
        try {
            const response = await fetch(`/api/appointments/month?start=${formattedStart}&end=${formattedEnd}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Make sure we're handling the response data correctly
            reservedDates = new Set(data.map(appointment => appointment.date));
        } catch (error) {
            console.error('Error fetching monthly reservations:', error);
            // Continue with empty reservedDates set
        }

        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const startingDay = (firstDay.getDay() + 6) % 7;
        
        const datesContainer = calendarContainer.querySelector('.calendar-dates');

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            datesContainer.appendChild(emptyDay);
        }

        // Add cells for each day of the month
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

        // Add event listeners for navigation buttons
        document.getElementById('prev-month')?.addEventListener('click', () => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
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
        
        // Format date in Bosnian
        const bosnianDays = {
            'Monday': 'Ponedjeljak',
            'Tuesday': 'Utorak',
            'Wednesday': 'Srijeda',
            'Thursday': 'Četvrtak',
            'Friday': 'Petak',
            'Saturday': 'Subota',
            'Sunday': 'Nedjelja'
        };

        const englishDay = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const bosnianDay = bosnianDays[englishDay];
        
        const monthName = dateObj.toLocaleString('sr-Latn', { month: 'long' })
            .replace(/^\w/, c => c.toUpperCase());
        
        dateDisplay.textContent = `${bosnianDay}, ${dateObj.getDate()}. ${monthName} ${dateObj.getFullYear()}.`;
        
        dateDisplay.classList.add('visible');
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.style.display = 'grid';
        generateTimeSlots(dateObj);
    }

    async function generateTimeSlots(dateObj) {
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.innerHTML = '';
        timeSlotsContainer.classList.add('visible');
        
        const selectedService = document.querySelector('.service-card.selected');
        if (!selectedService) return;

        // Format date as YYYY-MM-DD
        const formattedDate = dateObj.toISOString().split('T')[0];
        console.log('Requesting slots for date:', formattedDate); // Debug log
        
        try {
            const response = await fetch(`/api/appointments/booked?date=${formattedDate}`);
            console.log('Response status:', response.status); // Debug log
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Server response:', data); // Debug log
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch appointments');
            }

            const bookedSlots = data.bookedSlots || [];
            
            // Create select element
            const select = document.createElement('select');
            select.id = 'time-select';
            select.className = 'time-select';
            select.style.display = 'block';

            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Izaberite vrijeme';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            select.appendChild(defaultOption);

            const startTime = 8 * 60;  // 8:00 AM in minutes
            const endTime = 16 * 60;   // 4:00 PM in minutes
            const interval = 10; // 10-minute intervals
            
            const serviceDuration = getServiceDuration(selectedService.dataset.service);

            // Generate available time slots
            for (let time = startTime; time < endTime; time += interval) {
                // Skip if this would create an appointment ending after business hours
                if (time + serviceDuration > endTime) continue;

                // Check if this time slot overlaps with any booked appointments
                let isBlocked = false;
                const currentTimeString = `${Math.floor(time/60).toString().padStart(2, '0')}:${(time%60).toString().padStart(2, '0')}`;
                
                for (const booking of bookedSlots) {
                    const bookingStart = convertTimeToMinutes(booking.time);
                    const bookingEnd = bookingStart + booking.duration;
                    
                    if (time >= bookingStart && time < bookingEnd || 
                        (time + serviceDuration) > bookingStart && time < bookingEnd) {
                        isBlocked = true;
                        break;
                    }
                }

                if (!isBlocked) {
                    const hours = Math.floor(time / 60);
                    const minutes = time % 60;
                    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    
                    const option = document.createElement('option');
                    option.value = timeString;
                    option.textContent = timeString;
                    select.appendChild(option);
                }
            }

            timeSlotsContainer.appendChild(select);

            // Add change event listener
            select.addEventListener('change', function() {
                const prevSelected = document.querySelector('.time-slot.selected');
                if (prevSelected) prevSelected.classList.remove('selected');
                this.classList.add('selected');
            });

        } catch (error) {
            console.error('Error generating time slots:', error);
            showNotification('Greška', 'Greška pri učitavanju termina: ' + error.message);
            
            // Add a basic select element even if there's an error
            const select = document.createElement('select');
            select.id = 'time-select';
            select.className = 'time-select';
            select.disabled = true;
            
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = 'Greška pri učitavanju termina';
            select.appendChild(errorOption);
            
            timeSlotsContainer.appendChild(select);
        }
    }

    // Helper function to convert time string to minutes
    function convertTimeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
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
        try {
            const selectedTime = document.querySelector('#time-select');
            
            if (!selectedTime || !selectedTime.value) {
                showNotification('Upozorenje', 'Molimo izaberite vrijeme');
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
                time: selectedTime.value,
                name: name,
                phone: phone,
                email: email
            };

            console.log('Sending appointment request:', appointment);

            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointment)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create appointment');
            }

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
                showNotification('Greška', result.error || 'Greška pri rezervaciji');
            }
        } catch (error) {
            console.error('Booking error:', error);
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

    // Helper function to get service duration
    function getServiceDuration(service) {
        const durations = {
            'brada': 20,
            'kosa': 30,
            'bradaikosa': 45
        };
        return durations[service] || 30;
    }
}); 