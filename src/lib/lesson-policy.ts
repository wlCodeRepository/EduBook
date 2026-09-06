export const LESSON_MINUTES = 50;
export const BREAK_MINUTES = 10;
export function lessonSpan(count: number) {
  return count * LESSON_MINUTES + (count - 1) * BREAK_MINUTES;
}
export function isTeacherHour(utc: string, timezone: string) {
  const date = new Date(utc);
  if (!Number.isFinite(+date) || date.getUTCSeconds() || date.getUTCMilliseconds()) return false;
  const minute = new Intl.DateTimeFormat('en-GB', {timeZone: timezone,minute:'2-digit'}).formatToParts(date).find(p=>p.type==='minute')?.value;
  return Number(minute) === 0;
}
