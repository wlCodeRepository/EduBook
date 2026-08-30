import { describe, expect, it } from 'vitest'
import { generateSlots, localDateTimeToUtc } from './booking'

describe('booking time calculations', () => {
  it('converts New York local time to UTC across a normal date', () => {
    expect(localDateTimeToUtc('2026-01-12', '09:00', 'America/New_York').toISOString()).toBe('2026-01-12T14:00:00.000Z')
  })

  it('only returns open future slots and excludes booked ranges', () => {
    const slots = generateSlots('2026-09-07', 1, 'Asia/Shanghai', 'Asia/Shanghai', 60, [{ id: 'a', teacher_id: 't', weekday: 1, local_start_time: '09:00', local_end_time: '12:00', effective_from: null, effective_until: null, enabled: true }], [], [{ id: 'b', teacher_id: 't', student_id: 's', start_at_utc: '2026-09-07T02:00:00Z', end_at_utc: '2026-09-07T03:00:00Z', status: 'CONFIRMED', cancellation_reason: null }], new Date('2026-09-01T00:00:00Z'))
    expect(slots.map((slot) => slot.available)).toEqual([true, false, true])
  })
})
