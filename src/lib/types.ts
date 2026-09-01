export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'

export interface Profile {
  id: string
  username?: string | null
  role: Role
  display_name: string
  email: string
  timezone: string
  default_lesson_minutes: number
}

export interface Availability {
  id: string
  teacher_id: string
  weekday: number
  local_start_time: string
  local_end_time: string
  effective_from: string | null
  effective_until: string | null
  enabled: boolean
}

export interface BlockedPeriod {
  id: string
  teacher_id: string
  start_at_utc: string
  end_at_utc: string
  reason: string | null
}

export interface Booking {
  id: string
  teacher_id: string
  student_id: string
  start_at_utc: string
  end_at_utc: string
  status: BookingStatus
  cancellation_reason: string | null
  teacher?: Profile
  student?: Profile
}
