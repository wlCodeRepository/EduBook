import { describe, expect, it } from 'vitest'
import { initialNavForRole } from './navigation'

describe('initialNavForRole', () => {
  it('takes administrators directly to account management', () => {
    expect(initialNavForRole('ADMIN')).toBe('admin')
  })

  it('keeps teachers and students in the booking workspace', () => {
    expect(initialNavForRole('TEACHER')).toBe('book')
    expect(initialNavForRole('STUDENT')).toBe('book')
  })
})
