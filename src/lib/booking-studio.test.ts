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

describe("fixed hourly lesson intervals", () => {
 const now=new Date('2026-01-01T00:00:00Z');
 const make=(n:number,ranges:{start_at_utc:string;end_at_utc:string}[]=[])=>studioSlot('2026-09-06T23:00:00Z',50,n,'UTC','Asia/Shanghai',ranges,'en',now);
 it('snapshots 50 teaching minutes and 10 minutes between hourly lessons',()=>{
  expect(make(1)?.endAtUtc).toBe('2026-09-06T23:50:00.000Z');
  expect(make(2)?.endAtUtc).toBe('2026-09-07T00:50:00.000Z');
  expect(make(8)?.endAtUtc).toBe('2026-09-07T06:50:00.000Z');
 });
 it('reserves breaks and rejects middle/tail conflicts while allowing adjacency',()=>{
  expect(make(2,[{start_at_utc:'2026-09-06T23:55:00Z',end_at_utc:'2026-09-07T00:00:00Z'}])?.available).toBe(false);
  expect(make(2,[{start_at_utc:'2026-09-07T00:45:00Z',end_at_utc:'2026-09-07T01:00:00Z'}])?.available).toBe(false);
  expect(make(1,[{start_at_utc:'2026-09-06T23:50:00Z',end_at_utc:'2026-09-07T00:00:00Z'}])?.available).toBe(true);
 });
 it('rejects invalid lengths and non-hour starts in teacher time',()=>{
  for(const n of [0,9,1.5])expect(make(n)).toBeNull();
  expect(studioSlot('2026-09-06T12:15:00Z',50,1,'UTC','UTC',[])).toBeNull();
  expect(studioSlot('2026-09-06T12:00:00Z',30,1,'UTC','UTC',[])).toBeNull();
  expect(studioSlot('2026-09-06T12:15:00Z',50,1,'UTC','Asia/Kathmandu',[],'en',now)?.available).toBe(true);
 });
 it('handles DST repeated hours and rejects a half-hour DST shift within a course',()=>{
  expect(studioSlot('2026-11-01T05:00:00Z',50,2,'America/New_York','America/New_York',[],'en',now)?.endAtUtc).toBe('2026-11-01T06:50:00.000Z');
  expect(studioSlot('2026-10-03T14:30:00Z',50,3,'UTC','Australia/Lord_Howe',[],'en',now)).toBeNull();
 });
});
