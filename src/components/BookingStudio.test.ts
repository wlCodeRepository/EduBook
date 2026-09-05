import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingStudio from "./BookingStudio.vue";
import type { Profile } from "../lib/types";
import type { BookingSlot } from "../lib/booking";

const teachers: Profile[] = ["a", "b"].map((id) => ({
  id,
  role: "TEACHER",
  display_name: `Teacher ${id}`,
  email: "",
  timezone: "UTC",
  default_lesson_minutes: 30,
}));
const views: ReturnType<typeof mount>[] = [];
function setup(extra = {}) {
  const view = mount(BookingStudio, {
    props: {
      teachers,
      selectedTeacherId: "a",
      busySlots: [],
      blocked: [],
      timezone: "UTC",
      language: "en",
      busy: false,
      loading: false,
      ...extra,
    },
  });
  views.push(view);
  return view;
}
const time = (hour: string) => `[data-start="2026-09-05T${hour}:00.000Z"]`;
describe("BookingStudio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T06:00:00Z"));
  });
  afterEach(() => {
    views.splice(0).forEach((view) => view.unmount());
    vi.useRealTimers();
  });
  it("emits initial nine-local-day UTC range and pages without entering the past", async () => {
    const view = setup();
    expect(view.emitted("range-change")).toEqual([
      [{ from: "2026-09-05T00:00:00.000Z", until: "2026-09-14T00:00:00.000Z" }],
    ]);
    expect(
      view.get(".date-navigation button").attributes("disabled"),
    ).toBeDefined();
    await view.findAll(".date-navigation button")[1].trigger("click");
    expect(view.emitted("range-change")?.at(-1)).toEqual([
      { from: "2026-09-12T00:00:00.000Z", until: "2026-09-21T00:00:00.000Z" },
    ]);
    await view.get('[data-date="2026-09-13"]').trigger("click");
    expect(view.emitted("range-change")).toHaveLength(3);
    await view.get(".date-navigation button").trigger("click");
    expect(
      view.get('[data-date="2026-09-05"]').attributes("aria-pressed"),
    ).toBe("true");
  });
  it("keeps teacher controlled, emits immediately, and resets on external change", async () => {
    const view = setup();
    await view.get(time("08:00")).trigger("click");
    await view.findAll(".teacher-choice")[1].trigger("click");
    expect(view.emitted("select-teacher")).toEqual([["b"]]);
    expect(view.findAll(".teacher-choice")[0].attributes("aria-pressed")).toBe(
      "true",
    );
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.setProps({ selectedTeacherId: "b", loading: true });
    expect(view.text()).toContain("Loading teacher availability");
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.setProps({ loading: false });
    expect(view.findAll(".teacher-choice")[1].attributes("aria-pressed")).toBe(
      "true",
    );
  });
  it("accepts length first, exposes shorter-only starts, disables conflicting counts and single starts", async () => {
    const view = setup({
      busySlots: [
        {
          start_at_utc: "2026-09-05T09:00:00Z",
          end_at_utc: "2026-09-05T10:00:00Z",
        },
      ],
    });
    await view.get('[data-lessons="4"]').trigger("click");
    expect(view.get(time("08:00")).text()).toContain("Shorter only");
    expect(view.get(time("09:00")).attributes("disabled")).toBeDefined();
    await view.get(time("08:00")).trigger("click");
    expect(view.text()).toContain("This full interval is unavailable");
    expect(view.get('[data-lessons="3"]').attributes("disabled")).toBeDefined();
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.get('[data-lessons="2"]').trigger("click");
    await view.get(".submit-booking").trigger("click");
    await view.get(".submit-booking").trigger("click");
    const events = view.emitted("submit")!;
    expect(events).toHaveLength(1);
    expect(events[0][0]).toMatchObject({
      startAtUtc: "2026-09-05T08:00:00.000Z",
      endAtUtc: "2026-09-05T09:00:00.000Z",
      available: true,
    });
  });
  it("accepts time first, updates conflicts on prop changes, respects loading and busy", async () => {
    const view = setup();
    await view.get(time("08:00")).trigger("click");
    await view.get('[data-lessons="8"]').trigger("click");
    expect(view.get(".lesson-ticket").text()).toContain("240 minutes");
    await view.setProps({ loading: true });
    await view.get(".submit-booking").trigger("click");
    expect(view.emitted("submit")).toBeUndefined();
    await view.setProps({
      loading: false,
      blocked: [
        {
          id: "block",
          teacher_id: "a",
          reason: null,
          start_at_utc: "2026-09-05T11:45:00Z",
          end_at_utc: "2026-09-05T12:15:00Z",
        },
      ],
    });
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.get('[data-lessons="1"]').trigger("click");
    await view.setProps({ busy: true });
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.setProps({ busy: false });
    await view.get(".submit-booking").trigger("click");
    expect(view.emitted("submit")).toHaveLength(1);
  });
  it("renders Chinese empty state and native keyboard-operable controls, clears timers", () => {
    const view = setup({
      teachers: [],
      selectedTeacherId: "",
      language: "zh-CN",
    });
    expect(view.text()).toContain("暂无可预约老师");
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    expect(
      view
        .findAll("button")
        .every((button) => button.attributes("type") === "button"),
    ).toBe(true);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses viewer-local days and includes DST transition in fetch bounds", () => {
    vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    const view = setup({ timezone: "America/New_York" });
    expect(view.emitted("range-change")?.[0]).toEqual([
      { from: "2026-10-31T04:00:00.000Z", until: "2026-11-09T05:00:00.000Z" },
    ]);
  });
  it("prioritizes error over loading, disables submit and retries via range-change", async () => {
    const view = setup();
    await view.get(time("08:00")).trigger("click");
    await view.setProps({ error: "Availability failed", loading: true });
    expect(view.get('[role="alert"]').text()).toContain("Availability failed");
    expect(view.text()).not.toContain("Loading teacher availability");
    expect(view.get(".booking-studio").attributes("aria-busy")).toBe("false");
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
    await view.get(".availability-error button").trigger("click");
    expect(view.emitted("range-change")).toHaveLength(2);
    expect(view.emitted("range-change")?.[1]).toEqual(
      view.emitted("range-change")?.[0],
    );
    await view.setProps({ error: "", loading: false });
    expect(view.find('[role="alert"]').exists()).toBe(false);
    expect(view.get(".submit-booking").attributes("disabled")).toBeUndefined();
  });
  it("checks the actual clock at submission even before the refresh timer runs", async () => {
    const view = setup();
    await view.get(time("08:00")).trigger("click");
    vi.setSystemTime(new Date("2026-09-05T08:01:00Z"));
    await view.get(".submit-booking").trigger("click");
    expect(view.emitted("submit")).toBeUndefined();
  });
  it("shows only one time group and keeps every group accessible", async () => {
    const view = setup();
    expect(view.findAll("[data-start]")).toHaveLength(24);
    expect(view.find(".time-offset").exists()).toBe(false);
    await view.findAll(".period-switch button")[3].trigger("click");
    expect(view.findAll("[data-start]")).toHaveLength(24);
    expect(view.find('[data-start="2026-09-05T23:45:00.000Z"]').exists()).toBe(
      true,
    );
  });
  it("replaces a submitted selection with a receipt without reporting its own reservation as conflict", async () => {
    const view = setup();
    await view.get(time("08:00")).trigger("click");
    await view.get('[data-lessons="4"]').trigger("click");
    await view.get(".submit-booking").trigger("click");
    const receipt = view.emitted("submit")![0][0] as BookingSlot;
    await view.setProps({
      receipt,
      busySlots: [
        {
          start_at_utc: "2026-09-05T08:00:00Z",
          end_at_utc: "2026-09-05T10:00:00Z",
        },
      ],
    });
    expect(view.get(".booking-receipt").text()).toContain(
      "awaiting teacher confirmation",
    );
    expect(view.find(".conflict").exists()).toBe(false);
    expect(view.get(".submit-booking").attributes("disabled")).toBeDefined();
  });
});
