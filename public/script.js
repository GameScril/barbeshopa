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

    function createCalendar(date) {
        if (!calendarContainer) {
            console.error('Calendar container not found!');
            return;
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
            dateCell.textContent = day;

            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            const now = new Date();
            const isToday = dateObj.toDateString() === now.toDateString();
            const isAfterBusinessHours = now.getHours() >= 16; // 4 PM
            const isPast = dateObj < now || (isToday && isAfterBusinessHours);

            if (isWeekend || isPast) {
                dateCell.classList.add('disabled');
            } else {
                dateCell.classList.add('available');
                dateCell.addEventListener('click', () => selectDate(dateObj, dateCell));
            }

            if (selectedDate && dateObj.toDateString() === selectedDate.toDateString()) {
                dateCell.classList.add('selected');
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

    function selectDate(date, cell) {
        // Don't allow selecting past dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (date < today) {
            showNotification('Upozorenje', 'Ne možete izabrati datum u prošlosti');
            return;
        }

        document.querySelectorAll('.calendar-dates div').forEach(div => {
            div.classList.remove('selected');
        });
        
        cell.classList.add('selected');
        selectedDate = date;
        
        // Format date in Serbian
        dateDisplay.textContent = date.toLocaleDateString('sr-Latn', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Europe/Belgrade'
        });
        
        dateDisplay.classList.add('visible');
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.style.display = 'grid'; // Ensure time slots are visible
        generateTimeSlots(date);
    }

    async function generateTimeSlots(date) {
        timeSlots.innerHTML = '';
        const startTime = 8; // 8 AM
        const endTime = 16; // 4 PM

        try {
            // Format date to YYYY-MM-DD for API
            const formattedDate = date.toISOString().split('T')[0];
            const response = await fetch(`${API_BASE_URL}/api/appointments?date=${formattedDate}`);
            const bookedAppointments = await response.json();
            
            // Create Set of booked times for efficient lookup
            const bookedTimes = new Set(bookedAppointments.map(apt => apt.time));

            for (let hour = startTime; hour < endTime; hour++) {
                for (let minutes of ['00', '30']) {
                    const timeSlot = document.createElement('div');
                    timeSlot.classList.add('time-slot');
                    
                    const formattedHour = hour.toString().padStart(2, '0');
                    const timeString = `${formattedHour}:${minutes}`;
                    timeSlot.textContent = timeString;

                    if (bookedTimes.has(timeString)) {
                        timeSlot.classList.add('booked');
                        timeSlot.title = 'Termin je zauzet';
                    } else {
                        timeSlot.addEventListener('click', () => selectTimeSlot(timeSlot));
                    }

                    timeSlots.appendChild(timeSlot);
                }
            }
        } catch (error) {
            console.error('Error fetching booked appointments:', error);
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
        document.querySelectorAll('.time-slot').forEach(s => {
            s.classList.remove('selected');
        });
        slot.classList.add('selected');
    }

    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            serviceCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
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
        if (!selectedDate) {
            showNotification('Upozorenje', 'Molimo izaberite datum');
            return;
        }

        const selectedService = document.querySelector('.service-card.selected');
        const selectedTime = document.querySelector('.time-slot.selected');
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;

        if (!selectedService || !selectedTime || !name || !phone || !email) {
            showNotification('Upozorenje', 'Molimo popunite sva polja');
            return;
        }

        const appointment = {
            service: selectedService.dataset.service,
            price: parseInt(selectedService.dataset.price),
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime.textContent,
            name: name,
            phone: phone,
            email: email
        };

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
                showNotification('Uspješno', 'Termin uspješno rezervisan!');
                // Reset form
                document.getElementById('name').value = '';
                document.getElementById('phone').value = '';
                document.getElementById('email').value = '';
                selectedDate = null;
                dateDisplay.textContent = '';
                dateDisplay.classList.remove('visible');
                timeSlots.innerHTML = '';
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
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
}); 