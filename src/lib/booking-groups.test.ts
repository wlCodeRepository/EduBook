import { describe, it, expect } from "vitest";
import { bookingGroup, bookingDisplayStatus } from "./booking-groups";
import type { Booking } from "./types";
const now = new Date("2026-09-05T00:00:00Z");
const booking = (status: Booking["status"], end: string) => ({
  status,
  end_at_utc: end,
});
describe("booking queue boundaries", () => {
  it("keeps expired confirmed lessons out of the pending and upcoming queues", () => {
    const old = booking("CONFIRMED", "2026-09-04T07:00:00Z");
    expect(bookingGroup(old, now)).toBe("history");
    expect(bookingDisplayStatus(old, now)).toBe("COMPLETED");
  });
  it("only active pending requests are actionable", () => {
    expect(bookingGroup(booking("PENDING", "2026-09-06T00:00:00Z"), now)).toBe(
      "pending",
    );
    expect(
      bookingDisplayStatus(booking("PENDING", now.toISOString()), now),
    ).toBe("EXPIRED");
    expect(
      bookingGroup(booking("CONFIRMED", "2026-09-06T00:00:00Z"), now),
    ).toBe("upcoming");
    expect(
      bookingGroup(booking("CANCELLED", "2026-09-06T00:00:00Z"), now),
    ).toBe("history");
  });
});
