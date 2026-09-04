import { describe, expect, it } from "vitest";
import { teacherWeek } from "./teacher-week";
import type { Booking } from "./types";
const booking = (
  start: string,
  end: string,
  status: Booking["status"] = "CONFIRMED",
): Booking => ({
  id: "lesson",
  teacher_id: "teacher",
  student_id: "student",
  start_at_utc: start,
  end_at_utc: end,
  status,
  cancellation_reason: null,
});
describe("teacher local week", () => {
  it("uses the teacher local date when UTC has already moved to Monday", () => {
    const week = teacherWeek(
      [],
      "America/New_York",
      new Date("2026-09-07T01:00:00Z"),
    );
    expect(week[0].key).toBe("2026-08-31");
    expect(week[6].today).toBe(true);
  });
  it("includes both days of an overnight lesson but treats midnight ends as exclusive", () => {
    const now = new Date("2026-09-07T04:00:00Z");
    const overnight = teacherWeek(
      [booking("2026-09-07T15:30:00Z", "2026-09-07T16:30:00Z")],
      "Asia/Shanghai",
      now,
    );
    expect(overnight.slice(0, 2).map((day) => day.bookings.length)).toEqual([
      1, 1,
    ]);
    const midnight = teacherWeek(
      [booking("2026-09-07T15:00:00Z", "2026-09-07T16:00:00Z")],
      "Asia/Shanghai",
      now,
    );
    expect(midnight.slice(0, 2).map((day) => day.bookings.length)).toEqual([
      1, 0,
    ]);
  });
  it("shows pending and completed lessons but omits rejected and cancelled requests", () => {
    const statuses: Booking["status"][] = [
      "PENDING",
      "CONFIRMED",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ];
    const week = teacherWeek(
      statuses.map((status) =>
        booking("2026-09-07T10:00:00Z", "2026-09-07T11:00:00Z", status),
      ),
      "UTC",
      new Date("2026-09-07"),
    );
    expect(week[0].bookings.map((item) => item.status)).toEqual(
      statuses.slice(0, 3),
    );
  });
});
