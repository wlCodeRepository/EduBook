import type { Role } from './types'

/** Keeps each role in the workspace that represents its first useful action. */
export function initialNavForRole(role: Role) {
  return role === 'ADMIN' ? 'admin' : 'book'
}
