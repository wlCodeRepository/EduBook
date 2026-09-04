import type { Booking } from "./types";
type Record = Pick<Booking, "status" | "end_at_utc">;
export type BookingGroup = "pending" | "upcoming" | "history";
export function bookingGroup(booking: Record, now = new Date()): BookingGroup {
  if (Date.parse(booking.end_at_utc) <= now.getTime()) return "history";
  if (booking.status === "PENDING") return "pending";
  if (booking.status === "CONFIRMED") return "upcoming";
  return "history";
}
export function bookingDisplayStatus(booking: Record, now = new Date()) {
  if (Date.parse(booking.end_at_utc) <= now.getTime()) {
    if (booking.status === "CONFIRMED") return "COMPLETED";
    if (booking.status === "PENDING") return "EXPIRED";
  }
  return booking.status;
}
