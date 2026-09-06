import { describe, expect, it } from 'vitest';
import { campusDuration, campusStatus, campusTime, type CampusBooking } from './campus-teaching';
const booking: CampusBooking = { id: 'b', teacher_id: 't', student_id: 's', status: 'CONFIRMED', start_at_utc: '2026-09-06T23:45:00Z', end_at_utc: '2026-09-07T00:45:00Z', cancellation_reason: null };
describe('teaching presentation helpers', () => {
  it('shows teaching time and reserved time separately for hourly bookings',()=>{
    expect(campusDuration({...booking,lesson_count:2,lesson_minutes:50,break_minutes:10,end_at_utc:'2026-09-07T01:35:00Z'},'en')).toContain('110 min reserved');
  });
  it('uses stored duration snapshots and elapsed UTC time for legacy bookings', () => {
    expect(campusDuration({ ...booking, lesson_count: 2, lesson_minutes: 30 }, 'en')).toBe('2 lessons · 30 min each · 60 min');
    expect(campusDuration(booking, 'zh')).toBe('60 分钟');
  });
  it('formats viewer timezone and distinguishes expired requests from completed lessons', () => {
    expect(campusTime(booking.start_at_utc, 'Asia/Shanghai', 'en')).toContain('07:45');
    const now = new Date('2026-09-07T01:00:00Z');
    expect(campusStatus(booking, now, 'en')).toBe('Ended');
    expect(campusStatus({ ...booking, status: 'PENDING' }, now, 'zh')).toBe('已过期');
  });
});
