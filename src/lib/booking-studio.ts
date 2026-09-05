/**
 * Booking studio iteration — docs/plans/2026-09-05-learning-space.md, Task 2.
 * Plan: (1) test UTC-quarter traversal, DST, calendar paging and whole-range
 * conflicts; (2) implement isolated bilingual studio; (3) test both selection
 * orders, loading/teacher resets and single-event submission; run test/typecheck/build.
 * Integration: parent fetches busySlots after select-teacher and owns loading/busy.
 * selectedTeacherId is controlled; range-change emits UTC [from, until) for the
 * viewer-local seven-day page plus two trailing days, including on initial mount.
 * Parent need not add those two days again. Busy ranges must cover all displayed
 * starts AND their possible eight-lesson ends (extend further for durations >360m).
 * submit is one complete BookingSlot; local* are teacher time, viewer* viewer time.
 * No network writes. A submitted selection is latched until edited or busy completes.
 * error?: string overrides the loading presentation, blocks submission and exposes
 * a Retry action that re-emits range-change. All visuals are component-scoped.
 */
import type { BookingSlot } from "./booking";
import type { BusySlot } from "./types";

const QUARTER = 15 * 60_000;
/** Wall-clock fields must be resolved in the viewer's zone, never the device zone. */
export function studioLocalInstant(value: string, timezone: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  const matches = match
    ? studioStarts(match[1], timezone).filter((item) => item.time === match[2])
    : [];
  if (matches.length !== 1) throw new Error("invalid_or_ambiguous_local_time");
  return matches[0].utc;
}
export function studioDate(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftStudioDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export interface StudioStart {
  utc: string;
  time: string;
  offset: string;
  period: "night" | "morning" | "afternoon" | "evening";
}

/** Traverse real UTC instants, never construct ambiguous local clock times. */
export function studioStarts(date: string, timezone: string): StudioStart[] {
  const anchor = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const result: StudioStart[] = [];
  for (
    let at = anchor - 18 * 3_600_000;
    at < anchor + 42 * 3_600_000;
    at += QUARTER
  ) {
    const parts = formatter.formatToParts(new Date(at));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    if (`${part("year")}-${part("month")}-${part("day")}` !== date) continue;
    const hour = Number(part("hour"));
    result.push({
      utc: new Date(at).toISOString(),
      time: `${part("hour")}:${part("minute")}`,
      offset: part("timeZoneName"),
      period:
        hour < 6
          ? "night"
          : hour < 12
            ? "morning"
            : hour < 18
              ? "afternoon"
              : "evening",
    });
  }
  return result;
}

export function studioSlot(
  startUtc: string,
  duration: number,
  lessons: number,
  viewerTimezone: string,
  teacherTimezone: string,
  ranges: BusySlot[],
  language = "en",
  now = new Date(),
): BookingSlot | null {
  const start = Date.parse(startUtc);
  if (
    !Number.isFinite(start) ||
    start % QUARTER !== 0 ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 240 ||
    !Number.isInteger(lessons) ||
    lessons < 1 ||
    lessons > 8
  )
    return null;
  const end = start + duration * lessons * 60_000;
  const time = (at: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: teacherTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(at);
  const display = (at: number) =>
    new Intl.DateTimeFormat(language.startsWith("zh") ? "zh-CN" : "en-GB", {
      timeZone: viewerTimezone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    }).format(at);
  return {
    startAtUtc: new Date(start).toISOString(),
    endAtUtc: new Date(end).toISOString(),
    localDate: studioDate(new Date(start), teacherTimezone),
    localStart: time(start),
    localEnd: time(end),
    viewerStart: display(start),
    viewerEnd: display(end),
    available:
      start > now.getTime() &&
      !ranges.some(
        (range) =>
          Date.parse(range.start_at_utc) < end &&
          Date.parse(range.end_at_utc) > start,
      ),
  };
}
