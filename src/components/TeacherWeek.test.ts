import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherWeek from "./TeacherWeek.vue";
import type { Booking } from "../lib/types";

enableAutoUnmount(afterEach);

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "lesson",
    teacher_id: "teacher",
    student_id: "student",
    cancellation_reason: null,
    status: "CONFIRMED",
    start_at_utc: "2026-09-05T01:00:00Z",
    end_at_utc: "2026-09-05T02:00:00Z",
    student: {
      id: "student",
      role: "STUDENT",
      display_name: "小林",
      email: "student@example.com",
      timezone: "Asia/Shanghai",
      default_lesson_minutes: 60,
    },
    ...overrides,
  };
}

describe("teacher weekly timetable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("renders Monday through Sunday with separate weekdays, dates and empty states", () => {
    const view = mount(TeacherWeek, {
      props: { bookings: [], timezone: "UTC", language: "en" },
    });
    expect(view.findAll(".week-day")).toHaveLength(7);
    expect(view.findAll("h4 .weekday").map((day) => day.text())).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(view.findAll("h4 .day-number").map((day) => day.text())).toEqual([
      "31",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(view.findAll(".week-empty")).toHaveLength(7);
    expect(view.get(".week-empty").text()).toBe("No lessons");
    expect(view.findAll(".today-label")).toHaveLength(1);
    expect(view.get(".is-today .day-number").text()).toBe("5");
    expect(view.get(".today-label").text()).toBe("Today");
  });

  it("uses the selected timezone for the week, today and lesson placement across a UTC date boundary", async () => {
    vi.setSystemTime(new Date("2026-09-06T23:30:00Z"));
    const view = mount(TeacherWeek, {
      props: {
        bookings: [
          booking({
            start_at_utc: "2026-09-06T23:45:00Z",
            end_at_utc: "2026-09-07T00:45:00Z",
          }),
        ],
        timezone: "Asia/Shanghai",
        language: "zh",
      },
    });
    expect(view.findAll(".day-number").map((day) => day.text())).toEqual([
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
    ]);
    expect(view.findAll(".is-today")).toHaveLength(1);
    expect(view.get(".is-today .weekday").text()).toBe("周一");
    expect(view.get(".today-label").text()).toBe("今天");
    expect(view.get(".is-today .week-lesson strong").text()).toBe(
      "07:45 – 08:45",
    );
    expect(view.get(".is-today .week-lesson").text()).toContain("小林");
    expect(view.get(".week-lesson small").text()).toBe("已确认");

    await view.setProps({ timezone: "America/Los_Angeles", language: "en" });
    expect(view.get(".is-today .day-number").text()).toBe("6");
    expect(view.get(".is-today .weekday").text()).toBe("Sun");
    expect(view.get(".is-today .week-lesson strong").text()).toBe(
      "16:45 – 17:45",
    );
    expect(view.get(".today-label").text()).toBe("Today");
  });

  it("refreshes confirmed and pending lessons at their end time and clears its timer on unmount", async () => {
    vi.setSystemTime(new Date("2026-09-05T01:59:30Z"));
    const timerCount = vi.getTimerCount();
    const view = mount(TeacherWeek, {
      props: {
        bookings: [booking(), booking({ id: "pending", status: "PENDING" })],
        timezone: "Asia/Shanghai",
        language: "zh",
      },
    });
    expect(view.get(".week-lesson.confirmed small").text()).toBe("已确认");
    expect(view.get(".week-lesson.pending small").text()).toBe("待确认");
    expect(vi.getTimerCount()).toBe(timerCount + 1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(view.get(".week-lesson.completed small").text()).toBe("已结束");
    expect(view.get(".week-lesson.expired small").text()).toBe("已过期");
    await view.setProps({ language: "en" });
    expect(view.get(".week-lesson.completed small").text()).toBe("Ended");
    expect(view.get(".week-lesson.expired small").text()).toBe("Expired");
    view.unmount();
    expect(vi.getTimerCount()).toBe(timerCount);
  });
});
