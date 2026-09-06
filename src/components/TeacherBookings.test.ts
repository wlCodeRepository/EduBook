import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherBookings from "./TeacherBookings.vue";
import type { Booking } from "../lib/types";
import { mockCampusViewport } from './campus-teaching.test-helpers';
import { nextTick } from 'vue';
enableAutoUnmount(afterEach);
const request = (id: string, status: Booking['status'] = 'PENDING'): Booking => ({ id, status, teacher_id: 't', student_id: 's', cancellation_reason: null, start_at_utc: '2026-09-06T06:00:00Z', end_at_utc: '2026-09-06T07:00:00Z', lesson_count: 2, lesson_minutes: 30 });
describe("teacher booking workspace", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('paginates requests for desktop/mobile and clamps after data refresh', async () => {
    const viewport = mockCampusViewport();
    const view = mount(TeacherBookings, { props: { bookings: Array.from({ length: 11 }, (_, index) => request(`r-${index}`)), timezone: 'UTC', language: 'en' } });
    expect(view.findAll('.request-row')).toHaveLength(4);
    await view.get('[data-page="next"]').trigger('click');
    expect(view.get('.inbox-pagination').text()).toContain('2 / 3');
    viewport.resize(true);
    await nextTick();
    expect(view.findAll('.request-row')).toHaveLength(2);
    expect(view.get('.inbox-pagination').text()).toContain('1 / 6');
    await view.get('[data-page="next"]').trigger('click');
    await view.setProps({ bookings: [request('remaining')] });
    expect(view.get('.inbox-pagination').text()).toContain('1 / 1');
    view.unmount();
    expect(viewport.listeners.size).toBe(0);
  });
  it('locks decisions while busy, shows loading/error and preserves confirm, reject and cancel payloads', async () => {
    const view = mount(TeacherBookings, { props: { bookings: [request('pending'), request('confirmed', 'CONFIRMED')], timezone: 'Asia/Shanghai', language: 'en', busy: true } });
    expect(view.get('.request-row').text()).toContain('14:00');
    expect(view.get('.request-row').text()).toContain('2 lessons · 30 min each · 60 min');
    expect(view.get('.busy-note').text()).toContain('Saving');
    await view.get('.row-actions button').trigger('click');
    expect(view.emitted('action')).toBeUndefined();
    await view.setProps({ busy: false });
    await view.get('.row-actions button').trigger('click');
    await view.findAll('.row-actions button')[1].trigger('click');
    await view.findAll('.queue-tabs button')[1].trigger('click');
    await view.get('.row-actions button').trigger('click');
    expect(view.emitted('action')).toEqual([['pending', 'confirm'], ['pending', 'reject'], ['confirmed', 'cancel']]);
    await view.setProps({ loading: true });
    expect(view.get('[role="status"]').text()).toContain('Loading');
    expect(view.find('.row-actions').exists()).toBe(false);
    await view.setProps({ loading: false, error: 'failure' });
    expect(view.get('[role="alert"]').text()).toContain('Retry');
    expect(view.find('.row-actions').exists()).toBe(false);
    await view.setProps({ error: '', bookings: [] });
    expect(view.get('.queue-empty').text()).toContain('No lessons');
  });
  it('does not emit a decision for a booking that ended between clock ticks', async () => {
    const view = mount(TeacherBookings, { props: { bookings: [request('ended')], timezone: 'UTC', language: 'en' } });
    vi.setSystemTime(new Date('2026-09-06T07:00:01Z'));
    await view.get('.row-actions button').trigger('click');
    expect(view.emitted('action')).toBeUndefined();
  });
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
