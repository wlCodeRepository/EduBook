import { formatDateTimeInput } from "./booking";
import type { Booking } from "./types";

export function teacherWeek(
  bookings: Booking[],
  timezone: string,
  now = new Date(),
) {
  const today = formatDateTimeInput(now, timezone).slice(0, 10);
  const monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      today: key === today,
      bookings: bookings
        .filter((booking) => {
          if (!["PENDING", "CONFIRMED", "COMPLETED"].includes(booking.status))
            return false;
          const start = formatDateTimeInput(
            new Date(booking.start_at_utc),
            timezone,
          ).slice(0, 10);
          // End is exclusive: a lesson ending at midnight belongs to the previous day.
          const end = formatDateTimeInput(
            new Date(Date.parse(booking.end_at_utc) - 1),
            timezone,
          ).slice(0, 10);
          return start <= key && end >= key;
        })
        .sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc)),
    };
  });
}
