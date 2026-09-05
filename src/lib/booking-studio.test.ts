import { describe, expect, it } from "vitest";
import {
  shiftStudioDate,
  studioDate,
  studioSlot,
  studioStarts,
  studioLocalInstant,
} from "./booking-studio";

describe("studio calendar and real UTC candidates", () => {
  it("resolves blackout inputs in the display timezone and rejects ambiguous or invalid wall times", () => {
    expect(studioLocalInstant("2026-09-06T09:00", "Asia/Shanghai")).toBe(
      "2026-09-06T01:00:00.000Z",
    );
    expect(() =>
      studioLocalInstant("2026-11-01T01:30", "America/New_York"),
    ).toThrow("invalid_or_ambiguous_local_time");
    expect(() =>
      studioLocalInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
    expect(() => studioLocalInstant("2026-09-06T09:01", "UTC")).toThrow();
  });
  it("starts from the viewer date and pages across month/year boundaries", () => {
    expect(studioDate(new Date("2026-12-31T18:00:00Z"), "Asia/Shanghai")).toBe(
      "2027-01-01",
    );
    expect(shiftStudioDate("2026-12-28", 7)).toBe("2027-01-04");
    expect(shiftStudioDate("2027-01-04", -7)).toBe("2026-12-28");
  });
  it("includes all 24 hours with quarter-hour starts", () => {
    const starts = studioStarts("2026-09-06", "Asia/Kathmandu");
    expect(starts).toHaveLength(96);
    expect(starts[0].time).toBe("00:00");
    expect(starts.at(-1)?.time).toBe("23:45");
    expect(starts.every((s) => Date.parse(s.utc) % 900000 === 0)).toBe(true);
    expect(starts.filter((s) => s.period === "morning")).toHaveLength(24);
    expect(starts.filter((s) => s.period === "night")).toHaveLength(24);
  });
  it("omits spring DST gaps and preserves both autumn occurrences with offsets", () => {
    const spring = studioStarts("2026-03-08", "America/New_York");
    expect(spring).toHaveLength(92);
    expect(spring.some((s) => s.time.startsWith("02:"))).toBe(false);
    const autumn = studioStarts("2026-11-01", "America/New_York");
    expect(autumn).toHaveLength(100);
    const repeated = autumn.filter((s) => s.time === "01:30");
    expect(repeated).toHaveLength(2);
    expect(repeated[0].offset).not.toBe(repeated[1].offset);
    expect(Date.parse(repeated[1].utc) - Date.parse(repeated[0].utc)).toBe(
      3600000,
    );
  });
  it("supports half-hour DST transitions", () => {
    expect(studioStarts("2026-10-04", "Australia/Lord_Howe")).toHaveLength(94);
    expect(studioStarts("2026-04-05", "Australia/Lord_Howe")).toHaveLength(98);
  });
});

describe("whole lesson intervals", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const make = (
    count: number,
    ranges: { start_at_utc: string; end_at_utc: string }[] = [],
  ) =>
    studioSlot(
      "2026-09-06T23:45:00Z",
      45,
      count,
      "UTC",
      "Asia/Shanghai",
      ranges,
      "en",
      now,
    )!;
  it("emits exact multiples crossing midnight with teacher and viewer labels", () => {
    const slot = make(8);
    expect(slot.endAtUtc).toBe("2026-09-07T05:45:00.000Z");
    expect(slot.localDate).toBe("2026-09-07");
    expect(slot.localStart).toBe("07:45");
    expect(slot.localEnd).toBe("13:45");
    expect(slot.available).toBe(true);
    expect(slot.viewerStart).toContain("23:45");
  });
  it("checks middle and tail conflicts but allows adjacent half-open ranges", () => {
    const range = [
      {
        start_at_utc: "2026-09-07T00:30:00Z",
        end_at_utc: "2026-09-07T00:45:00Z",
      },
    ];
    expect(make(1, range).available).toBe(true);
    expect(make(2, range).available).toBe(false);
    expect(make(8, range).available).toBe(false);
    expect(
      make(1, [
        {
          start_at_utc: "2026-09-06T23:00:00Z",
          end_at_utc: "2026-09-06T23:45:00Z",
        },
      ]).available,
    ).toBe(true);
  });
  it("uses elapsed duration over the DST fallback", () => {
    const slot = studioSlot(
      "2026-11-01T05:30:00Z",
      60,
      1,
      "America/New_York",
      "America/New_York",
      [],
      "en",
      now,
    )!;
    expect(slot.localStart).toBe("01:30");
    expect(slot.localEnd).toBe("01:30");
    expect(slot.viewerStart).toContain("GMT-04:00");
    expect(slot.viewerEnd).toContain("GMT-05:00");
  });
  it("rejects invalid length and non-quarter starts, marks past instants unavailable", () => {
    for (const count of [0, 9, 1.5]) expect(make(count)).toBeNull();
    expect(studioSlot("invalid", 30, 1, "UTC", "UTC", [])).toBeNull();
    expect(
      studioSlot("2026-09-06T12:01:00Z", 30, 1, "UTC", "UTC", []),
    ).toBeNull();
    expect(
      studioSlot("2026-01-01T00:00:00Z", 30, 1, "UTC", "UTC", [], "en", now)
        ?.available,
    ).toBe(false);
  });
});
