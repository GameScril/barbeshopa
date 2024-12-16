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
                <button id="prev-month">&lt;</button>
                <h3>${capitalizedMonth} ${date.getFullYear()}</h3>
                <button id="next-month">&gt;</button>
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
        const datesContainer = calendarContainer.querySelector('.calendar-dates');

        // Get first day of month
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        // Get last day of month
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        // Get day of week for first day (0 = Sunday, 1 = Monday, etc)
        let firstDayIndex = firstDay.getDay() || 7; // Convert Sunday from 0 to 7
        firstDayIndex--; // Adjust to Monday = 0

        // Add empty cells for days before first day of month
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('empty');
            datesContainer.appendChild(emptyDiv);
        }

        // Add cells for each day of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayDiv = document.createElement('div');
            dayDiv.textContent = day;
            
            const currentDayDate = new Date(date.getFullYear(), date.getMonth(), day);
            
            // Add event listener and styling for each day
            if (currentDayDate >= new Date()) {
                dayDiv.addEventListener('click', () => selectDate(currentDayDate, dayDiv));
            } else {
                dayDiv.classList.add('disabled');
            }

            if (day === new Date().getDate() && 
                date.getMonth() === new Date().getMonth() && 
                date.getFullYear() === new Date().getFullYear()) {
                dayDiv.classList.add('today');
            }

            datesContainer.appendChild(dayDiv);
        }
    }

    function selectDate(dateObj, dateCell) {
        console.log('Selected date object:', dateObj);
        
        // Add validation for weekends and past dates
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateObj < today) {
            showNotification('Upozorenje', 'Ne možete izabrati datum u prošlosti');
            return;
        }

        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0) { // Sunday
            showNotification('Upozorenje', 'Ne radimo nedjeljom');
            return;
        }

        const selectedService = document.querySelector('.service-card.selected');
        if (!selectedService) {
            showNotification('Upozorenje', 'Molimo izaberite uslugu prvo');
            dateCell.classList.remove('selected');
            return;
        }

        // Clear previous selections
        document.querySelectorAll('.calendar-dates div').forEach(div => {
            div.classList.remove('selected');
        });
        
        dateCell.classList.add('selected');
        selectedDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        
        // Format and display the selected date
        const bosnianDays = {
            'Monday': 'Ponedjeljak',
            'Tuesday': 'Utorak',
            'Wednesday': 'Srijeda',
            'Thursday': 'Četvrtak',
            'Friday': 'Petak',
            'Saturday': 'Subota',
            'Sunday': 'Nedjelja'
        };

        const englishDay = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const bosnianDay = bosnianDays[englishDay];
        
        const monthName = selectedDate.toLocaleString('sr-Latn', { month: 'long' })
            .replace(/^\w/, c => c.toUpperCase());
        
        dateDisplay.textContent = `${bosnianDay}, ${selectedDate.getDate()}. ${monthName} ${selectedDate.getFullYear()}.`;
        dateDisplay.classList.add('visible');
        generateTimeSlots(selectedDate);
    }

    async function generateTimeSlots(dateObj) {
        const timeSlotsSelect = document.getElementById('time-slots');
        timeSlotsSelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Izaberite vrijeme';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        timeSlotsSelect.appendChild(defaultOption);

        try {
            const selectedService = document.querySelector('.service-card.selected');
            if (!selectedService) {
                showNotification('Upozorenje', 'Molimo izaberite uslugu prvo');
                return;
            }

            const serviceDuration = getServiceDuration(selectedService.dataset.service);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;

            // Check if it's Saturday
            const isSaturday = dateObj.getDay() === 6;
            // Set end time based on day
            const endTime = isSaturday ? 15 * 60 : 16 * 60; // 3 PM on Saturday, 4 PM other days

            const response = await fetch(`${API_BASE_URL}/api/appointments/slots/${formattedDate}`);
            if (!response.ok) {
                throw new Error('Failed to fetch booked slots');
            }

            const result = await response.json();
            const bookedSlots = result.bookedSlots || [];
            console.log('Received booked slots:', bookedSlots);

            // Convert booked slots to minutes ranges with duration
            const bookedRanges = bookedSlots.map(slot => {
                const [hours, minutes] = slot.time.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                const duration = parseInt(slot.duration) || 30;
                return {
                    start: startMinutes,
                    end: startMinutes + duration,
                    duration: duration
                };
            });
            console.log('Converted booked ranges:', bookedRanges);

            const startTime = 8 * 60; // 8:00
            const interval = 10; // 10-minute intervals

            for (let time = startTime; time <= endTime - serviceDuration; time += interval) {
                const slotEndTime = time + serviceDuration;
                
                // Detailed overlap check
                const isAvailable = !bookedRanges.some(range => {
                    const hasOverlap = (
                        (time >= range.start && time < range.end) || // Starts during a booking
                        (slotEndTime > range.start && slotEndTime <= range.end) || // Ends during a booking
                        (time <= range.start && slotEndTime >= range.end) // Encompasses a booking
                    );
                    
                    if (hasOverlap) {
                        console.log(`Slot ${formatMinutes(time)}-${formatMinutes(slotEndTime)} overlaps with booking ${formatMinutes(range.start)}-${formatMinutes(range.end)}`);
                    }
                    
                    return hasOverlap;
                });

                if (isAvailable) {
                    const option = document.createElement('option');
                    option.value = formatMinutes(time);
                    option.textContent = formatMinutes(time);
                    timeSlotsSelect.appendChild(option);
                }
            }

            const timeSlotsWrapper = document.querySelector('.time-slots-wrapper');
            timeSlotsWrapper.classList.add('visible');

        } catch (error) {
            console.error('Error generating time slots:', error);
            showNotification('Greška', 'Greška pri učitavanju termina');
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
            
            // Hide time slots when changing service
            const timeSlotsWrapper = document.querySelector('.time-slots-wrapper');
            timeSlotsWrapper.classList.remove('visible');
            
            // Clear date selection when changing service
            if (selectedDate) {
                document.querySelectorAll('.calendar-dates div').forEach(div => {
                    div.classList.remove('selected');
                });
                selectedDate = null;
                dateDisplay.textContent = '';
                dateDisplay.classList.remove('visible');
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
            const selectedTime = document.getElementById('time-slots');
            const selectedService = document.querySelector('.service-card.selected');
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;

            if (!selectedTime || !selectedTime.value || selectedTime.value === 'Izaberite vrijeme') {
                showNotification('Upozorenje', 'Molimo izaberite vrijeme');
                return;
            }

            if (!selectedDate) {
                showNotification('Upozorenje', 'Molimo izaberite datum');
                return;
            }

            if (!selectedService || !name || !phone) {
                showNotification('Upozorenje', 'Molimo popunite sva polja');
                return;
            }

            const appointment = {
                service: selectedService.dataset.service,
                price: parseInt(selectedService.dataset.price),
                date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
                time: selectedTime.value,
                name: name,
                phone: phone
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
        const timeSlotsWrapper = document.querySelector('.time-slots-wrapper');
        timeSlotsWrapper.classList.remove('visible');
    }

    function showNotification(title, message) {
        const modal = new bootstrap.Modal(document.getElementById('notification-modal'));
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modal.show();
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
            installButton.classList.remove('show');
        });
    }

    // Hide install button if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        if (installButton) {
            installButton.classList.remove('show');
        }
    }

    // Helper function to get service duration
    function getServiceDuration(service) {
        const durations = {
            'brada': 30,    // 30 minutes for beard
            'kosa': 30,     // 30 minutes for hair
            'bradaikosa': 60 // 60 minutes for both
        };
        return durations[service] || 30; // Default to 30 minutes if service not found
    }

    // Helper function to format minutes into HH:MM
    function formatMinutes(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    // Make sure to initialize any Bootstrap tooltips or popovers if you add them later
    document.addEventListener('DOMContentLoaded', function () {
        // Initialize all tooltips
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    });

    // Hide time slots wrapper initially
    const timeSlotsWrapper = document.querySelector('.time-slots-wrapper');
    if (timeSlotsWrapper) {
        timeSlotsWrapper.classList.remove('visible');
    }

    // Update the month navigation in createCalendar function
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        if (currentDate.getMonth() >= new Date().getMonth() || 
            currentDate.getFullYear() > new Date().getFullYear()) {
            handleMonthChange();
            createCalendar(currentDate);
        } else {
            // Reset to current month if trying to go before current month
            currentDate = new Date();
            createCalendar(currentDate);
        }
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        
        if (currentDate <= threeMonthsFromNow) {
            handleMonthChange();
            createCalendar(currentDate);
        } else {
            // Reset if trying to go beyond 3 months
            currentDate = new Date(threeMonthsFromNow);
            createCalendar(currentDate);
        }
    });

    // Add time slot selection handler
    const timeSlotSelect = document.getElementById('time-slots');
    timeSlotSelect.addEventListener('change', (e) => {
        const selectedTime = e.target.value;
        if (selectedTime) {
            // Add selected class to wrapper to show it's been selected
            const timeSlotsWrapper = document.querySelector('.time-slots-wrapper');
            timeSlotsWrapper.classList.add('selected');
            
            // Update the date display to include the selected time
            if (selectedDate && dateDisplay) {
                const formattedDate = selectedDate.toLocaleDateString('sr-Latn', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                dateDisplay.textContent = `${formattedDate} u ${selectedTime}`;
                dateDisplay.classList.add('visible');
            }
        }
    });
}); 