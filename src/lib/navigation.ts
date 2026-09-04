import type { Role } from './types'

/** Keeps each role in the workspace that represents its first useful action. */
export function initialNavForRole(role: Role) {
  if (role === 'ADMIN') return 'overview'
  if (role === 'TEACHER') return 'teacher-overview'
  return 'book'
}
