document.addEventListener('DOMContentLoaded', () => {
    // Remove debug logs in production
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
        installButton: document.getElementById('install-button')
    };

    // Move all constants to the top
    const DURATIONS = {
        'brada': 10,
        'kosa': 20,
        'bradaikosa': 30
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let currentDate = new Date();
    let selectedDate = null;
    let deferredPrompt;

    // Combine modal functions
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

    // Combine date handling functions
    function handleDateSelection(dateObj, dateCell) {
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        
        if (dateObj.getDay() === 0) {
            showModal('Upozorenje', 'Nedjelja je neradni dan');
            return;
        }

        if (dateObj < today) {
            showModal('Upozorenje', 'Ne možete izabrati datum u prošlosti');
            return;
        }

        const selectedService = document.querySelector('.service-card.selected');
        if (!selectedService) {
            showModal('Upozorenje', 'Molimo izaberite uslugu prvo');
            dateCell.classList.remove('selected');
            return;
        }

        // Rest of the date selection logic remains the same
    }

    // Combine install button logic
    function handleInstallButton() {
        if (isIOS) {
            if (elements.installButton) {
                elements.installButton.classList.add('show');
                elements.installButton.addEventListener('click', () => {
                    showModal('Instalacija na iPhone', `
                        Za dodavanje na početni ekran:<br>
                        1. Kliknite na dugme "Share" (Podijeli) <br>
                        2. Scroll down i kliknite "Add to Home Screen" (Dodaj na početni ekran)<br>
                        3. Kliknite "Add" (Dodaj)
                    `, true);
                });
            }
        } else {
            // Android install logic remains the same
        }
    }

    // Initialize the app
    function init() {
        createCalendar(currentDate);
        handleInstallButton();
        
        // Initialize tooltips once
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        
        if (elements.timeSlotsWrapper) {
            elements.timeSlotsWrapper.classList.remove('visible');
        }
    }

    // Start the app
    init();
}); 