if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

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
        phoneInput: document.getElementById('phone'),
        totalPriceDisplay: document.getElementById('total-price-display'),
        homeNextSlotBadge: document.getElementById('next-slot-badge'),
        homeNextSlotDate: document.getElementById('next-slot-date'),
        homeNextSlotTime: document.getElementById('next-slot-time'),
        homeNextSlotStatus: document.getElementById('next-slot-status')
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' });
    const API_URL = '/api';
    const WORK_DAYS = new Set([1, 2, 3, 4, 5, 6]);
    const SERVICE_CONFIG = {
        pranje: { label: 'Pranje', duration: 10, price: 5 },
        depilacija: { label: 'Depilacija', duration: 10, price: 5 },
        ciscenjeusiju: { label: 'Čišćenje ušiju', duration: 10, price: 10 },
        sisanje: { label: 'Šišanje', duration: 20, price: 13 },
        brada: { label: 'Brada', duration: 10, price: 7 },
        sisanjeibrada: { label: 'Šišanje i brada', duration: 30, price: 20 }
    };

    let selectedDate = null;
    let selectedServices = [];
    let currentViewingDate = new Date();
    let reservationRefreshTimer = null;
    let homeRefreshTimer = null;

    function getDateString(dateObj) {
        return dateFormatter.format(dateObj);
    }

    function formatDisplayDate(dateObj) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}.${month}.${year}`;
    }

    function isWorkingDay(dateObj) {
        const day = dateObj.getDay();
        return WORK_DAYS.has(day === 0 ? 7 : day);
    }

    function showModal(title, message, isHTML = false) {
        if (!elements.modal || !window.bootstrap || !window.bootstrap.Modal) {
            const plainMessage = typeof message === 'string'
                ? message.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
                : String(message);
            window.alert(plainMessage);
            return;
        }

        const modal = new bootstrap.Modal(elements.modal);
        elements.modalTitle.textContent = title;
        if (isHTML) {
            elements.modalMessage.innerHTML = message;
        } else {
            elements.modalMessage.textContent = message;
        }
        modal.show();
    }

    function getServiceConfig(service) {
        return SERVICE_CONFIG[service] || null;
    }

    function getSelectedServiceConfigs() {
        return selectedServices.map(service => getServiceConfig(service)).filter(Boolean);
    }

    function getSelectedDuration() {
        return getSelectedServiceConfigs().reduce((total, service) => total + service.duration, 0);
    }

    function getSelectedPrice() {
        return getSelectedServiceConfigs().reduce((total, service) => total + service.price, 0);
    }

    function getSelectedServiceLabel() {
        return getSelectedServiceConfigs().map(service => service.label).join(' + ');
    }

    function updateTotalPriceDisplay() {
        if (!elements.totalPriceDisplay) return;

        const total = getSelectedPrice();
        if (!selectedServices.length) {
            elements.totalPriceDisplay.textContent = 'Ukupno: 0 KM';
            return;
        }

        const labels = getSelectedServiceConfigs().map(service => service.label).join(' + ');
        elements.totalPriceDisplay.textContent = `Ukupno: ${total} KM${labels ? ` · ${labels}` : ''}`;
    }

    function hasConflictWithSelection(candidate) {
        const hasHair = selectedServices.includes('sisanje');
        const hasBeard = selectedServices.includes('brada');
        const hasCombo = selectedServices.includes('sisanjeibrada');

        if (candidate === 'sisanjeibrada') {
            return selectedServices.length > 0;
        }

        if (hasCombo) {
            return true;
        }

        if (candidate === 'sisanje' && hasBeard) {
            return true;
        }

        if (candidate === 'brada' && hasHair) {
            return true;
        }

        return false;
    }

    function init() {
        if (elements.calendarContainer && elements.timeSlots && elements.bookButton) {
            initReservationPage();
        }

        if (elements.homeNextSlotBadge && elements.homeNextSlotDate && elements.homeNextSlotTime) {
            initHomePage();
        }

        handleInstallButton();
    }

    function initReservationPage() {
        createCalendar(currentViewingDate);

        if (elements.phoneInput) {
            elements.phoneInput.setAttribute('inputmode', 'numeric');
            elements.phoneInput.setAttribute('maxlength', '9');
            elements.phoneInput.addEventListener('input', () => {
                const digitsOnly = elements.phoneInput.value.replace(/\D/g, '').slice(0, 9);
                elements.phoneInput.value = digitsOnly;
            });
        }

        elements.serviceCards.forEach(card => {
            card.addEventListener('click', () => {
                const service = card.dataset.service;
                const isSelected = selectedServices.includes(service);

                if (isSelected) {
                    selectedServices = selectedServices.filter(item => item !== service);
                    card.classList.remove('selected');
                } else {
                    if (service === 'sisanjeibrada') {
                        selectedServices = selectedServices.filter(item => item !== 'sisanje' && item !== 'brada');
                        document.querySelector('.service-card[data-service="sisanje"]')?.classList.remove('selected');
                        document.querySelector('.service-card[data-service="brada"]')?.classList.remove('selected');
                    } else if (service === 'sisanje' || service === 'brada') {
                        selectedServices = selectedServices.filter(item => item !== 'sisanjeibrada');
                        document.querySelector('.service-card[data-service="sisanjeibrada"]')?.classList.remove('selected');
                    }

                    selectedServices = [...selectedServices, service];
                    card.classList.add('selected');
                }

                elements.serviceCards.forEach(serviceCard => {
                    serviceCard.classList.remove('disabled-choice');
                });

                updateTotalPriceDisplay();

                if (selectedDate) {
                    fetchAvailableSlots(selectedDate);
                }
            });
        });

        elements.bookButton.addEventListener('click', handleBooking);

        reservationRefreshTimer = window.setInterval(() => {
            if (selectedDate) {
                fetchAvailableSlots(selectedDate);
            }
        }, 60000);
    }

    function initHomePage() {
        updateHomeNextSlot();
        homeRefreshTimer = window.setInterval(updateHomeNextSlot, 60000);
    }

    function handleInstallButton() {
        if (!elements.installButton) return;

        // Hide if already running as installed PWA
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        // Always show the button
        elements.installButton.classList.add('show');

        elements.installButton.addEventListener('click', () => {
            const message = `
                <div style="text-align: left; font-size: 0.95rem; line-height: 1.5;">
                    <p><strong>🍎 iOS (iPhone/iPad):</strong><br>
                    1. Otvorite stranicu u <b>Safari</b> pregledniku.<br>
                    2. Dodirnite ikonu <b>Share</b> (kvadrat sa strelicom gore) na dnu ekrana.<br>
                    3. Odaberite <b>"Add to Home Screen"</b>.</p>
                    <p><strong>🤖 Android:</strong><br>
                    1. U <b>Chrome</b> pregledniku dodirnite <b>tri tačkice</b> gore desno.<br>
                    2. Odaberite <b>"Add to Home screen"</b>.</p>
                    <p><strong>💻 PC (Windows/Mac):</strong><br>
                    1. U Chrome/Edge kliknite na <b>ikonu monitora sa strelicom</b> u adresnoj traci.<br>
                    2. Odaberite <b>Install</b> (Instaliraj).</p>
                </div>
            `;
            showModal('Instalacija aplikacije', message, true);
        });
    }

    async function updateHomeNextSlot() {
        if (!elements.homeNextSlotBadge || !elements.homeNextSlotDate || !elements.homeNextSlotTime) return;

        try {
            elements.homeNextSlotBadge.textContent = 'Učitavanje...';
            elements.homeNextSlotDate.textContent = 'Provjera termina...';
            elements.homeNextSlotTime.textContent = '';

            if (elements.homeNextSlotStatus) {
                elements.homeNextSlotStatus.textContent = 'Slobodan';
            }

            const response = await fetch(`${API_URL}/appointments/next-slot`);
            const data = await response.json();

            if (!data.success || !data.nextSlot) {
                throw new Error(data.error || 'Nema dostupnih termina');
            }

            elements.homeNextSlotBadge.textContent = data.nextSlot.isToday ? 'Danas' : data.nextSlot.displayDate.split(',')[0];
            elements.homeNextSlotDate.textContent = data.nextSlot.displayDate;
            elements.homeNextSlotTime.textContent = data.nextSlot.time;

            if (elements.homeNextSlotStatus) {
                elements.homeNextSlotStatus.textContent = data.nextSlot.isToday ? 'Danas' : 'Slobodan';
            }
        } catch (error) {
            elements.homeNextSlotBadge.textContent = 'Nedostupno';
            elements.homeNextSlotDate.textContent = 'Trenutno nema podataka';
            elements.homeNextSlotTime.textContent = '';

            if (elements.homeNextSlotStatus) {
                elements.homeNextSlotStatus.textContent = 'Provjeri kasnije';
            }
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

        const monthNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

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
            const isDisabled = isPast || !isWorkingDay(dateObj);
            const isSelected = selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;
            const isToday = dateObj.getTime() === today.getTime();

            const classes = ['calendar-date-cell'];
            if (isDisabled) classes.push('disabled');
            if (isSelected) classes.push('selected');
            if (isToday) classes.push('today');

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
        if (!selectedServices.length) {
            showModal('Upozorenje', 'Molimo prvo izaberite uslugu!');
            return;
        }

        selectedDate = dateObj;

        const dateStr = formatDisplayDate(dateObj);
        elements.dateDisplay.textContent = `Odabrani datum: ${dateStr}`;
        elements.dateDisplay.classList.add('visible');

        createCalendar(currentViewingDate);
        fetchAvailableSlots(dateObj);
    }

    async function fetchAvailableSlots(dateObj) {
        const dateString = getDateString(dateObj);

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
        const startHour = 8;
        const endHour = 16;
        const duration = getSelectedDuration();

        let optionsHtml = '<option selected disabled>Izaberite vrijeme</option>';
        let hasSlots = false;

        const now = new Date();
        const isToday = selectedDate && selectedDate.toDateString() === now.toDateString();

        if (selectedDate && !isWorkingDay(selectedDate)) {
            elements.timeSlots.innerHTML = '<option selected disabled>Rezervacije nisu dostupne nedjeljom</option>';
            return;
        }

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
                    const bookingEnd = bookingStart + parseInt(booking.duration, 10);

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

    async function handleBooking() {
        if (!selectedServices.length) return showModal('Upozorenje', 'Izaberite uslugu!');
        if (!selectedDate) return showModal('Upozorenje', 'Izaberite datum!');
        if (elements.timeSlots.value === 'Izaberite vrijeme' || !elements.timeSlots.value) {
            return showModal('Upozorenje', 'Izaberite vrijeme!');
        }
        if (!elements.nameInput.value.trim()) return showModal('Upozorenje', 'Unesite Ime i Prezime!');
        if (!elements.phoneInput.value.trim()) return showModal('Upozorenje', 'Unesite Broj Mobitela!');

        const payload = {
            service: getSelectedServiceLabel(),
            services: selectedServices,
            price: getSelectedPrice(),
            date: getDateString(selectedDate),
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
                elements.serviceCards.forEach(c => c.classList.remove('selected', 'disabled-choice'));
                selectedServices = [];
                selectedDate = null;
                elements.dateDisplay.classList.remove('visible');
                updateTotalPriceDisplay();
                createCalendar(currentViewingDate);
                updateHomeNextSlot();
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

    updateTotalPriceDisplay();
    init();
});