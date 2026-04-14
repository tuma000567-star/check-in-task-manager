import { toDateOnly, daysBetween, todayIso } from './dates.js';

export const MAX_CHECKIN_DAYS = 14;

export function calculateCurrentDay(device, logs) {
  const deviceLogs = logs
    .filter((l) => l.device_id === device.id)
    .sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

  const today = toDateOnly(new Date());

  let startDate = toDateOnly(device.checkin_start_date);
  for (const log of deviceLogs) {
    if (log.status === 'error') {
      const next = toDateOnly(log.log_date);
      next.setDate(next.getDate() + 1);
      startDate = next;
    }
  }

  if (today < startDate) return 1;
  const day = daysBetween(startDate, today) + 1;
  return Math.min(MAX_CHECKIN_DAYS, Math.max(1, day));
}

export function getLogForDay(device, logs, dayNumber) {
  const deviceLogs = logs.filter((l) => l.device_id === device.id);
  return deviceLogs.find((l) => l.day_number === dayNumber) || null;
}

export function getTodayLog(device, logs) {
  const today = todayIso();
  return logs.find(
    (l) => l.device_id === device.id && l.log_date === today
  ) || null;
}

export function buildCalendar(device, logs) {
  const currentDay = calculateCurrentDay(device, logs);
  const deviceLogs = logs
    .filter((l) => l.device_id === device.id)
    .sort((a, b) => new Date(b.log_date) - new Date(a.log_date));

  let cycleStart = toDateOnly(device.checkin_start_date);
  for (const log of [...deviceLogs].reverse()) {
    if (log.status === 'error') {
      const next = toDateOnly(log.log_date);
      next.setDate(next.getDate() + 1);
      cycleStart = next;
    }
  }

  const cells = [];
  for (let i = 0; i < MAX_CHECKIN_DAYS; i++) {
    const cellDate = new Date(cycleStart);
    cellDate.setDate(cellDate.getDate() + i);
    const isoDate = cellDate.toISOString().slice(0, 10);
    const log = deviceLogs.find(
      (l) => l.log_date === isoDate && l.day_number === i + 1
    );
    cells.push({
      day: i + 1,
      date: isoDate,
      status: log ? log.status : i + 1 < currentDay ? 'missed' : i + 1 === currentDay ? 'today' : 'future',
    });
  }
  return { cells, currentDay };
}
