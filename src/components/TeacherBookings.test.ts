import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeacherBookings from "./TeacherBookings.vue";
import type { Booking } from "../lib/types";
describe("teacher booking workspace", () => {
  afterEach(() => vi.useRealTimers());
  it("separates pending requests from ended lessons and removes history actions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
    const common = {
      teacher_id: "t",
      student_id: "s",
      cancellation_reason: null,
    };
    const bookings: Booking[] = [
      {
        ...common,
        id: "old",
        status: "CONFIRMED",
        start_at_utc: "2026-09-04T06:00:00Z",
        end_at_utc: "2026-09-04T07:00:00Z",
      },
      {
        ...common,
        id: "new",
        status: "PENDING",
        start_at_utc: "2026-09-06T06:00:00Z",
        end_at_utc: "2026-09-06T07:00:00Z",
      },
    ];
    const view = mount(TeacherBookings, {
      props: { bookings, timezone: "UTC", language: "en" },
    });
    expect(view.findAll(".request-row")).toHaveLength(1);
    await view.get(".row-actions button").trigger("click");
    expect(view.emitted("action")).toEqual([["new", "confirm"]]);
    await view.findAll(".queue-tabs button")[2].trigger("click");
    expect(view.findAll(".request-row")).toHaveLength(1);
    expect(view.get(".request-row").text()).toContain("Ended");
    expect(view.find(".row-actions").exists()).toBe(false);
    view.unmount();
  });
});
