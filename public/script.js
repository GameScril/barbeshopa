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

        try {
            // Fetch all reservations for this month
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const formattedStart = startOfMonth.toISOString().split('T')[0];
            const formattedEnd = endOfMonth.toISOString().split('T')[0];
            
            console.log('Fetching reservations for:', { formattedStart, formattedEnd });
            
            const response = await fetch(`/api/appointments/month?start=${formattedStart}&end=${formattedEnd}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Server response:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch reservations');
            }

            const reservedDates = new Set(result.data);

            // Generate calendar dates
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const startingDay = (firstDay.getDay() + 6) % 7; // Adjust for Monday start
            
            const datesContainer = calendarContainer.querySelector('.calendar-dates');

            // Add empty cells for days before the first day of the month
            for (let i = 0; i < startingDay; i++) {
                const emptyDay = document.createElement('div');
                datesContainer.appendChild(emptyDay);
            }

            // Add cells for each day of the month
            for (let i = 1; i <= lastDay.getDate(); i++) {
                const dateObj = new Date(date.getFullYear(), date.getMonth(), i);
                const dateCell = document.createElement('div');
                dateCell.textContent = i;
                
                const formattedDate = dateObj.toISOString().split('T')[0];
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const now = new Date();
                const isToday = dateObj.toDateString() === now.toDateString();
                const isPast = dateObj < now;

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

            // Add navigation event listeners
            document.getElementById('prev-month')?.addEventListener('click', () => {
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
                if (newDate.getMonth() >= new Date().getMonth() || 
                    newDate.getFullYear() > new Date().getFullYear()) {
                    currentDate = newDate;
                    handleMonthChange();
                    createCalendar(currentDate);
                }
            });

            document.getElementById('next-month')?.addEventListener('click', () => {
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
                const threeMonthsFromNow = new Date();
                threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                
                if (newDate <= threeMonthsFromNow) {
                    currentDate = newDate;
                    handleMonthChange();
                    createCalendar(currentDate);
                }
            });

        } catch (error) {
            console.error('Error in createCalendar:', error);
            showNotification('Greška', 'Greška pri učitavanju kalendara');
        }
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
        
        const select = document.createElement('select');
        select.id = 'time-select';
        select.classList.add('time-select');
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Izaberite vrijeme';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        select.appendChild(defaultOption);

        try {
            // Get selected service duration
            const selectedService = document.querySelector('.service-card.selected');
            if (!selectedService) {
                showNotification('Upozorenje', 'Molimo izaberite uslugu prvo');
                return;
            }
            const serviceDuration = getServiceDuration(selectedService.dataset.service);

            const formattedDate = dateObj.toISOString().split('T')[0];
            const response = await fetch(`/api/appointments/slots/${formattedDate}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch booked slots');
            }
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch booked slots');
            }

            // Create array of all possible time slots
            const startMinutes = 8 * 60; // 8:00
            const endMinutes = 16 * 60; // 16:00
            const lastPossibleStartTime = endMinutes - serviceDuration;

            // Create array of booked time ranges
            const bookedRanges = result.bookedSlots.map(slot => {
                const [hours, minutes] = slot.time.split(':').map(Number);
                const startTime = hours * 60 + minutes;
                return {
                    start: startTime,
                    end: startTime + slot.duration
                };
            });

            // Generate time slots in 5-minute increments
            for (let currentMinute = startMinutes; currentMinute <= lastPossibleStartTime; currentMinute += 5) {
                const slotEnd = currentMinute + serviceDuration;
                
                // Check if this slot overlaps with any booking
                const isOverlapping = bookedRanges.some(booking => 
                    (currentMinute < booking.end && slotEnd > booking.start)
                );

                if (!isOverlapping) {
                    const hour = Math.floor(currentMinute / 60);
                    const minute = currentMinute % 60;
                    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    
                    const option = document.createElement('option');
                    option.value = timeString;
                    option.textContent = timeString;
                    select.appendChild(option);
                }
            }

            if (select.children.length <= 1) { // Only has the default option
                const noTimesOption = document.createElement('option');
                noTimesOption.value = '';
                noTimesOption.disabled = true;
                noTimesOption.textContent = 'Nema dostupnih termina za izabranu uslugu';
                select.appendChild(noTimesOption);
            }

            timeSlotsContainer.appendChild(select);
            timeSlotsContainer.classList.add('visible');

        } catch (error) {
            console.error('Error generating time slots:', error);
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
            'brada': 10,
            'kosa': 20,
            'bradaikosa': 30
        };
        return durations[service] || 20;
    }
}); 