import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherCampus from './TeacherCampus.vue';
import type { Booking } from '../lib/types';

enableAutoUnmount(afterEach);
const booking = (id: string, status: Booking['status'], start = '2026-09-05T06:00:00Z', end = '2026-09-05T07:00:00Z'): Booking => ({ id, status, start_at_utc: start, end_at_utc: end, teacher_id: 't', student_id: 's', cancellation_reason: null, lesson_count: 2, lesson_minutes: 30 });
describe('teacher campus', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T00:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('uses actual confirmed lessons and unexpired requests, and forwards navigation and blackout events', async () => {
    const view = mount(TeacherCampus, { props: { bookings: [booking('next', 'CONFIRMED'), booking('request', 'PENDING'), booking('expired', 'PENDING', '2026-09-04T06:00:00Z', '2026-09-04T07:00:00Z')], timezone: 'Asia/Shanghai', language: 'en', lessonMinutes: 45 } });
    expect(view.get('[data-testid="next-lesson"]').text()).toContain('14:00');
    expect(view.get('[data-testid="next-lesson"]').text()).toContain('2 lessons');
    expect(view.findAll('.request-lane-item')).toHaveLength(1);
    expect(view.findAll('.week-day')).toHaveLength(7);
    await view.get('[data-action="requests"]').trigger('click');
    await view.get('[data-action="settings"]').trigger('click');
    await view.get('.week-block-button').trigger('click');
    expect(view.emitted('requests')).toEqual([[]]);
    expect(view.emitted('settings')).toEqual([[]]);
    expect(view.emitted('block-date')?.[0]).toEqual(['2026-08-31']);
  });
  it('shows loading without false empty states and cleans up clocks', async () => {
    const count = vi.getTimerCount();
    const view = mount(TeacherCampus, { props: { bookings: [], timezone: 'UTC', language: 'en', lessonMinutes: 30, loading: true } });
    expect(view.get('[role="status"]').text()).toContain('Loading');
    expect(view.find('.week-block-button').exists()).toBe(false);
    await view.setProps({ loading: false });
    expect(view.text()).toContain('No upcoming lesson');
    view.unmount();
    expect(vi.getTimerCount()).toBe(count);
  });
});
