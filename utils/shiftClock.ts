export interface ShiftClock {
  shiftName: 'Day Shift' | 'Night Shift';
  shiftStart: Date;
  shiftEnd: Date;
  timeRemaining: string;
}

function atTime(base: Date, hours: number, dayOffset = 0) {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(hours, 0, 0, 0);
  return next;
}

/** Day shift is 06:00–18:00. Night shift is 18:00–06:00. Times follow the tablet clock. */
export function getShiftClock(now = new Date()): ShiftClock {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const day = minutes >= 6 * 60 && minutes < 18 * 60;
  const shiftStart = day
    ? atTime(now, 6)
    : minutes >= 18 * 60
      ? atTime(now, 18)
      : atTime(now, 18, -1);
  const shiftEnd = day
    ? atTime(now, 18)
    : minutes >= 18 * 60
      ? atTime(now, 6, 1)
      : atTime(now, 6);

  const diff = Math.max(0, shiftEnd.getTime() - now.getTime());
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  return {
    shiftName: day ? 'Day Shift' : 'Night Shift',
    shiftStart,
    shiftEnd,
    timeRemaining: `Handover in ${hours}h ${mins}m`,
  };
}

export function windowFor(mode: '12h' | '24h', now = new Date()) {
  if (mode === '24h') {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
  }
  const clock = getShiftClock(now);
  return { start: clock.shiftStart, end: clock.shiftEnd };
}

export function inWindow(iso: string | null | undefined, start: Date, end: Date) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}
