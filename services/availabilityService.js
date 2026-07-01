const WORK_START_MINUTES = 8 * 60;
const WORK_END_MINUTES = 16 * 60;
const SLOT_STEP_MINUTES = 10;
const DEFAULT_LOOKAHEAD_DAYS = 30;
const DEFAULT_LEAD_TIME_MINUTES = 30;
const MIN_SLOT_DURATION = 10;
const WORK_DAYS = new Set([1, 2, 3, 4, 5, 6]);

function pad(value) {
    return String(value).padStart(2, '0');
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(date) {
    return date
        .toLocaleDateString('bs-BA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        .replace(/\//g, '.');
}

function formatWeekday(date) {
    const weekday = date.toLocaleDateString('bs-BA', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function minutesToTime(minutes) {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function roundUpToStep(minutes, step) {
    return Math.ceil(minutes / step) * step;
}

function hasConflict(slotStartMinutes, slotDurationMinutes, bookedSlots) {
    const slotEndMinutes = slotStartMinutes + slotDurationMinutes;

    return bookedSlots.some(booking => {
        const [hours, minutes] = booking.time.split(':').map(Number);
        const bookingStartMinutes = hours * 60 + minutes;
        const bookingDurationMinutes = Number(booking.duration || 0);
        const bookingEndMinutes = bookingStartMinutes + bookingDurationMinutes;

        return slotStartMinutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes;
    });
}

function findAvailableSlotForDay({ date, bookedSlots, now, slotDuration = MIN_SLOT_DURATION, leadTimeMinutes = DEFAULT_LEAD_TIME_MINUTES }) {
    const dateKey = formatDateKey(date);
    const nowKey = formatDateKey(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const searchStartMinutes = dateKey === nowKey
        ? Math.max(WORK_START_MINUTES, roundUpToStep(currentMinutes + leadTimeMinutes, SLOT_STEP_MINUTES))
        : WORK_START_MINUTES;

    for (let slotStartMinutes = searchStartMinutes; slotStartMinutes + slotDuration <= WORK_END_MINUTES; slotStartMinutes += SLOT_STEP_MINUTES) {
        if (!hasConflict(slotStartMinutes, slotDuration, bookedSlots)) {
            return {
                dateKey,
                time: minutesToTime(slotStartMinutes),
                startMinutes: slotStartMinutes,
                endMinutes: slotStartMinutes + slotDuration
            };
        }
    }

    return null;
}

function formatSlotDate(date, now) {
    const dateKey = formatDateKey(date);
    const todayKey = formatDateKey(now);

    if (dateKey === todayKey) {
        return `Danas, ${formatDateLabel(date)}`;
    }

    return `${formatWeekday(date)}, ${formatDateLabel(date)}`;
}

function isWorkingDay(date) {
    const day = date.getDay();
    return WORK_DAYS.has(day === 0 ? 7 : day);
}

async function findNextAvailableSlot({ fetchBookedSlots, now = new Date(), lookaheadDays = DEFAULT_LOOKAHEAD_DAYS, slotDuration = MIN_SLOT_DURATION, leadTimeMinutes = DEFAULT_LEAD_TIME_MINUTES }) {
    const searchStart = new Date(now);
    searchStart.setHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset <= lookaheadDays; dayOffset++) {
        const candidateDate = new Date(searchStart);
        candidateDate.setDate(searchStart.getDate() + dayOffset);
        if (!isWorkingDay(candidateDate)) {
            continue;
        }
        const dateKey = formatDateKey(candidateDate);
        const bookedSlots = await fetchBookedSlots(dateKey, candidateDate) || [];
        const slot = findAvailableSlotForDay({
            date: candidateDate,
            bookedSlots,
            now,
            slotDuration,
            leadTimeMinutes
        });

        if (slot) {
            return {
                ...slot,
                displayDate: formatSlotDate(candidateDate, now),
                isToday: dateKey === formatDateKey(now),
                badgeText: dateKey === formatDateKey(now) ? 'Danas' : formatWeekday(candidateDate)
            };
        }
    }

    return null;
}

module.exports = {
    findNextAvailableSlot,
    formatDateKey,
    minutesToTime,
    isWorkingDay
};