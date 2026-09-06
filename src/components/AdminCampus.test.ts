import { mount, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AdminCampus from './AdminCampus.vue'
import type { AdminBooking } from '../lib/types'

enableAutoUnmount(afterEach)
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T23:30:00Z')) })
afterEach(() => vi.useRealTimers())
const booking: AdminBooking = { id: 'one', teacher_id: 't', student_id: 's', start_at_utc: '2026-09-06T23:45:00Z', end_at_utc: '2026-09-07T00:45:00Z', status: 'CONFIRMED', cancellation_reason: null, teacher: { display_name: 'Ada', timezone: 'UTC' }, student: { display_name: 'Lin', timezone: 'UTC' } }
const props = { dashboard: { teachers: 3, students: 12, pending: 9, confirmed: 4, completed: 2, upcoming: 7 }, bookings: [booking], timezone: 'Asia/Shanghai', language: 'en' }

it('derives seven local calendar days and counts from supplied bookings, not dashboard totals', async () => {
  const view = mount(AdminCampus, { props })
  expect(view.findAll('[data-day]')).toHaveLength(7)
  expect(view.get('[data-day="2026-09-07"] .day-count').text()).toBe('1')
  expect(view.get('.booking-row').text()).toContain('07:45')
  expect(view.get('.booking-row').text()).toContain('2026-09-07')
  expect(view.get('.roster-facts').text()).toContain('12')
  await view.setProps({ timezone: 'America/Los_Angeles' })
  expect(view.get('[data-day="2026-09-06"] .day-count').text()).toBe('1')
  expect(view.get('.booking-row').text()).toContain('16:45')
})

it('supports day selection, navigation and loading without false empty facts', async () => {
  const view = mount(AdminCampus, { props })
  await view.get('[data-day="2026-09-08"]').trigger('click')
  expect(view.find('.booking-row').exists()).toBe(false)
  await view.get('[data-action="people"]').trigger('click')
  await view.get('[data-action="bookings"]').trigger('click')
  await view.get('[data-action="create"]').trigger('click')
  expect(view.emitted('navigate')).toEqual([['people'], ['bookings']])
  expect(view.emitted('create')).toHaveLength(1)
  await view.setProps({ loading: true })
  expect(view.get('[role="status"]').text()).toContain('Loading')
  expect(view.find('.roster-facts').exists()).toBe(false)
})

it('keeps calendar days intact across DST and clears its clock on unmount', () => {
  vi.setSystemTime(new Date('2026-10-31T18:00:00Z'))
  const initial = vi.getTimerCount()
  const view = mount(AdminCampus, { props: { ...props, timezone: 'America/New_York', bookings: [] } })
  expect(view.findAll('[data-day]').map(day => day.attributes('data-day'))).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
  view.unmount()
  expect(vi.getTimerCount()).toBe(initial)
})
