import { describe, expect, it } from 'vitest'
import { initialNavForRole } from './navigation'

describe('initialNavForRole', () => {
  it('takes administrators directly to platform overview', () => {
    expect(initialNavForRole('ADMIN')).toBe('overview')
  })

  it('takes teachers to their desk and students to booking', () => {
    expect(initialNavForRole('TEACHER')).toBe('teacher-overview')
    expect(initialNavForRole('STUDENT')).toBe('book')
  })
})
