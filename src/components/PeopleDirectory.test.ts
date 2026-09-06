import { mount, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import PeopleDirectory from './PeopleDirectory.vue'
import type { AdminUser } from '../lib/types'
enableAutoUnmount(afterEach)
afterEach(() => vi.unstubAllGlobals())
const user = (id: string, role: AdminUser['role'], name: string): AdminUser => ({ id, role, display_name: name, username: id, timezone: 'Asia/Shanghai', default_lesson_minutes: 45, created_at: '2026-09-01T00:00:00Z' })
const teacher = user('teacher', 'TEACHER', 'Ada')
const student = user('student', 'STUDENT', 'Lin')
const props = { users: [user('self', 'TEACHER', 'Self'), user('admin', 'ADMIN', 'Administrator'), teacher, student], currentUserId: 'self', language: 'en' }

it('excludes self and every admin, searches usernames and filters roles', async () => {
  const view = mount(PeopleDirectory, { props })
  expect(view.findAll('.person-select')).toHaveLength(2)
  expect(view.text()).not.toContain('Administrator')
  expect(view.text()).not.toContain('Self')
  await view.get('input[type="search"]').setValue(' STUDENT ')
  expect(view.findAll('.person-select')).toHaveLength(1)
  expect(view.get('.person-detail').text()).toContain('Lin')
  expect(view.get('.person-detail').text()).not.toContain('45')
  expect(view.get('.person-detail').text()).not.toContain('minutes')
  await view.get('input[type="search"]').setValue('')
  await view.get('button[aria-label="Role"]').trigger('click')
  await view.findAll('[role="option"]').find(option=>option.text()==='Teachers')!.trigger('click')
  expect(view.get('.person-select').text()).toContain('Ada')
})

it('emits separate actions for the selected person and respects busy state', async () => {
  const view = mount(PeopleDirectory, { props })
  await view.findAll('.person-select')[1]!.trigger('click')
  for (const action of ['edit', 'reset', 'delete']) {
    await view.get(`[data-action="${action}"]`).trigger('click')
    expect(view.emitted(action)?.[0]).toEqual([student])
  }
  await view.get('[data-action="create"]').trigger('click')
  expect(view.emitted('create')).toHaveLength(1)
  await view.setProps({ busy: true })
  for (const button of view.findAll('button')) expect(button.element.matches(':disabled')).toBe(true)
})

it('updates selection when users disappear and shows loading and empty states', async () => {
  const view = mount(PeopleDirectory, { props })
  await view.setProps({ users: [student] })
  expect(view.get('.person-detail').text()).toContain('Lin')
  await view.setProps({ loading: true })
  expect(view.get('[role="status"]').text()).toContain('Loading')
  expect(view.find('.person-detail').exists()).toBe(false)
  await view.setProps({ loading: false, users: [] })
  expect(view.get('[role="status"]').text()).toContain('No people')
})

it('paginates desktop at six people and selects from the current page', async () => {
  const view = mount(PeopleDirectory, { props: { ...props, users: Array.from({ length: 9 }, (_, index) => user(`u${index}`, 'STUDENT', `Person ${index}`)) } })
  expect(view.findAll('.person-select')).toHaveLength(6)
  await view.get('[data-action="next"]').trigger('click')
  expect(view.findAll('.person-select')).toHaveLength(3)
  expect(view.get('.person-detail').text()).toContain('Person 6')
  await view.get('input[type="search"]').setValue('Person 0')
  expect(view.findAll('.person-select')).toHaveLength(1)
  expect(view.get('.pagination').text()).toContain('1 / 1')
})

it('uses four rows on mobile and offers detail/back navigation with listener cleanup', async () => {
  const remove = vi.fn()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: remove })))
  const view = mount(PeopleDirectory, { props: { ...props, users: Array.from({ length: 7 }, (_, index) => user(`u${index}`, 'STUDENT', `Person ${index}`)) } })
  await view.vm.$nextTick()
  expect(view.findAll('.person-select')).toHaveLength(4)
  await view.findAll('.person-select')[2]!.trigger('click')
  expect(view.get('.directory-layout').classes()).toContain('show-detail')
  expect(view.get('.person-detail').text()).toContain('Person 2')
  await view.get('.back-button').trigger('click')
  expect(view.get('.directory-layout').classes()).not.toContain('show-detail')
  await view.get('.person-select').trigger('click')
  await view.setProps({ users: [] })
  expect(view.get('.directory-layout').classes()).not.toContain('show-detail')
  expect(view.get('[role="status"]').text()).toContain('No people')
  view.unmount()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})
