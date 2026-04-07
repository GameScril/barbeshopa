document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        serviceCards: document.querySelectorAll('.service-card'),
        timeSlots: document.getElementById('time-slots'),
        bookButton: document.getElementById('book-appointment'),
        dateDisplay: document.getElementById('selected-date'),
        calendarContainer: document.getElementById('calendar-container'),
        modal: document.getElementById('notification-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        modalClose: document.querySelector('.modal-close'),
        timeSlotsWrapper: document.querySelector('.time-slots-wrapper'),
        installButton: document.getElementById('install-button'),
        nameInput: document.getElementById('name'),
        phoneInput: document.getElementById('phone')
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let selectedDate = null;
    let selectedService = null;
    let selectedPrice = null;
    let currentViewingDate = new Date();

    const API_URL = '/api';

    function showModal(title, message, isHTML = false) {
        const modal = new bootstrap.Modal(elements.modal);
        elements.modalTitle.textContent = title;
        if (isHTML) {
            elements.modalMessage.innerHTML = message;
        } else {
            elements.modalMessage.textContent = message;
        }
        modal.show();
    }

    function init() {
        createCalendar(currentViewingDate);
        handleInstallButton();

        elements.serviceCards.forEach(card => {
            card.addEventListener('click', () => {
                elements.serviceCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedService = card.dataset.service;
                selectedPrice = card.dataset.price;

                if (selectedDate) {
                    fetchAvailableSlots(selectedDate);
                }
            });
        });

        elements.bookButton.addEventListener('click', handleBooking);
    }

    function handleInstallButton() {
        if (!elements.installButton) return;

        if (isIOS) {
            elements.installButton.classList.add('show');
            elements.installButton.addEventListener('click', () => {
                showModal('Instalacija na iPhone', `
                    Za dodavanje na početni ekran:<br>
                    1. Kliknite na dugme "Share" (Podijeli) <br>
                    2. Scroll down i kliknite "Add to Home Screen" (Dodaj na početni ekran)<br>
                    3. Kliknite "Add" (Dodaj)
                `, true);
            });
        } else {
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                elements.installButton.classList.add('show');
            });
            elements.installButton.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        elements.installButton.classList.remove('show');
                    }
                    deferredPrompt = null;
                }
            });
        }
    }

    function createCalendar(date) {
        if (!elements.calendarContainer) return;

        const year = date.getFullYear();
        const month = date.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        let firstDayIndex = firstDay.getDay() || 7;
        firstDayIndex--;

        const monthNames = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

        let html = `
            <div class="calendar-header d-flex justify-content-between align-items-center mb-2">
                <button class="btn btn-outline-light btn-sm" id="prev-month" aria-label="Previous month">&lt;</button>
                <h3 class="mb-0">${monthNames[month]} ${year}</h3>
                <button class="btn btn-outline-light btn-sm" id="next-month" aria-label="Next month">&gt;</button>
            </div>
            <div class="calendar-days text-center mb-2">
                <div class="calendar-day-label">Pon</div><div class="calendar-day-label">Uto</div><div class="calendar-day-label">Sri</div>
                <div class="calendar-day-label">Čet</div><div class="calendar-day-label">Pet</div><div class="calendar-day-label">Sub</div><div class="calendar-day-label">Ned</div>
            </div>
            <div class="calendar-dates" style="text-align: center;">
        `;

        for (let i = 0; i < firstDayIndex; i++) {
            html += `<div class="calendar-spacer"></div>`;
        }

        const today = new Date(new Date().setHours(0, 0, 0, 0));

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateObj = new Date(year, month, day);
            const isPast = dateObj < today;
            const isSunday = dateObj.getDay() === 0;
            const isDisabled = isPast || isSunday;
            const isSelected = selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;
            const isToday = dateObj.getTime() === today.getTime();

            const classes = ["calendar-date-cell"];
            if (isDisabled) classes.push("disabled");
            if (isSelected) classes.push("selected");
            if (isToday) classes.push("today");

            html += `<div class="${classes.join(' ')}" data-day="${day}" ${isDisabled ? 'aria-disabled="true"' : ''}>${day}</div>`;
        }

        html += `</div>`;
        elements.calendarContainer.innerHTML = html;

        document.getElementById('prev-month').addEventListener('click', () => {
            currentViewingDate.setMonth(currentViewingDate.getMonth() - 1);
            createCalendar(currentViewingDate);
        });
        document.getElementById('next-month').addEventListener('click', () => {
            currentViewingDate.setMonth(currentViewingDate.getMonth() + 1);
            createCalendar(currentViewingDate);
        });

        elements.calendarContainer.querySelectorAll('.calendar-date-cell:not(.disabled)').forEach(cell => {
            cell.addEventListener('click', function () {
                const day = parseInt(this.getAttribute('data-day'), 10);
                const clickedDate = new Date(year, month, day);
                selectDate(clickedDate);
            });
        });
    }

    function selectDate(dateObj) {
        if (!selectedService) {
            showModal('Upozorenje', 'Molimo prvo izaberite uslugu!');
            return;
        }

        selectedDate = dateObj;

        const dateStr = dateObj.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        elements.dateDisplay.textContent = `Odabrani datum: ${dateStr}`;
        elements.dateDisplay.classList.add('visible');

        createCalendar(currentViewingDate);
        fetchAvailableSlots(dateObj);
    }

    async function fetchAvailableSlots(dateObj) {
        const offset = dateObj.getTimezoneOffset();
        const targetDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
        const dateString = targetDate.toISOString().split('T')[0];

        try {
            elements.timeSlots.innerHTML = '<option selected disabled>Učitavanje...</option>';
            if (elements.timeSlotsWrapper) elements.timeSlotsWrapper.classList.add('visible');

            const response = await fetch(`${API_URL}/appointments/slots/${dateString}`);
            const data = await response.json();

            if (!data.success) throw new Error(data.error || 'Nije moguće učitati termine');

            generateTimeSlots(data.bookedSlots || []);
        } catch (error) {
            showModal('Greška', error.message);
            elements.timeSlots.innerHTML = '<option selected disabled>Izaberite vrijeme</option>';
        }
    }

    function generateTimeSlots(bookedSlots) {
        const startHour = 9;
        const endHour = 18;
        const duration = getDuration(selectedService);

        let optionsHtml = '<option selected disabled>Izaberite vrijeme</option>';
        let hasSlots = false;

        const now = new Date();
        const isToday = selectedDate.toDateString() === now.toDateString();

        for (let h = startHour; h < endHour; h++) {
            for (let m = 0; m < 60; m += 10) {
                const slotMinutes = h * 60 + m;
                const slotEndMinutes = slotMinutes + duration;

                if (slotEndMinutes > endHour * 60) continue;

                if (isToday) {
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    if (slotMinutes <= currentMinutes + 30) {
                        continue;
                    }
                }

                const hasConflict = bookedSlots.some(booking => {
                    const [bh, bm] = booking.time.split(':').map(Number);
                    const bookingStart = bh * 60 + bm;
                    const bookingEnd = bookingStart + parseInt(booking.duration);

                    return (
                        (slotMinutes >= bookingStart && slotMinutes < bookingEnd) ||
                        (slotEndMinutes > bookingStart && slotEndMinutes <= bookingEnd) ||
                        (slotMinutes <= bookingStart && slotEndMinutes >= bookingEnd)
                    );
                });

                if (!hasConflict) {
                    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    optionsHtml += `<option value="${timeStr}">${timeStr}</option>`;
                    hasSlots = true;
                }
            }
        }

        if (!hasSlots) {
            optionsHtml = '<option selected disabled>Nema slobodnih termina za odabrani datum i uslugu</option>';
        }

        elements.timeSlots.innerHTML = optionsHtml;
    }

    function getDuration(service) {
        const durations = { 'brada': 10, 'kosa': 20, 'bradaikosa': 30 };
        return durations[service] || 20;
    }

    async function handleBooking() {
        if (!selectedService) return showModal('Upozorenje', 'Izaberite uslugu!');
        if (!selectedDate) return showModal('Upozorenje', 'Izaberite datum!');
        if (elements.timeSlots.value === 'Izaberite vrijeme' || !elements.timeSlots.value)
            return showModal('Upozorenje', 'Izaberite vrijeme!');
        if (!elements.nameInput.value.trim()) return showModal('Upozorenje', 'Unesite Ime i Prezime!');
        if (!elements.phoneInput.value.trim()) return showModal('Upozorenje', 'Unesite Broj Mobitela!');

        const offset = selectedDate.getTimezoneOffset();
        const targetDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
        const dateString = targetDate.toISOString().split('T')[0];

        const payload = {
            service: selectedService,
            price: parseInt(selectedPrice),
            date: dateString,
            time: elements.timeSlots.value,
            name: elements.nameInput.value.trim(),
            phone: elements.phoneInput.value.trim()
        };

        const origText = elements.bookButton.textContent;
        elements.bookButton.innerHTML = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span> Rezervisanje...';
        elements.bookButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                showModal('Uspješno', 'Vaš termin je uspješno rezervisan!');
                elements.nameInput.value = '';
                elements.phoneInput.value = '';
                elements.timeSlots.innerHTML = '<option selected disabled>Izaberite vrijeme</option>';
                elements.serviceCards.forEach(c => c.classList.remove('selected'));
                selectedService = null;
                selectedDate = null;
                elements.dateDisplay.classList.remove('visible');
                createCalendar(currentViewingDate);
            } else {
                showModal('Greška', data.error || 'Došlo je do greške prilikom rezervacije.');
                fetchAvailableSlots(selectedDate);
            }
        } catch (error) {
            showModal('Greška', 'Došlo je do greške pri komunikaciji sa serverom.');
        } finally {
            elements.bookButton.textContent = origText;
            elements.bookButton.disabled = false;
        }
    }

    init();
});