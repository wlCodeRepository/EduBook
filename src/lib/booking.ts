import type { Availability, BlockedPeriod, Booking } from './types'

export interface BookingSlot {
  startAtUtc: string
  endAtUtc: string
  localDate: string
  localStart: string
  localEnd: string
  viewerStart: string
  viewerEnd: string
  available: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

function localParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string, string>>((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value
    return out
  }, {})
  return values
}

export function localDateTimeToUtc(localDate: string, localTime: string, timezone: string): Date {
  const [year, month, day] = localDate.split('-').map(Number)
  const [hour, minute] = localTime.slice(0, 5).split(':').map(Number)
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const probe = new Date(naive)
  const parts = localParts(probe, timezone)
  const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return new Date(naive - (rendered - naive))
}

export function formatViewerTime(utcIso: string, timezone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(utcIso))
}

function overlaps(start: Date, end: Date, ranges: Array<{ start_at_utc: string; end_at_utc: string }>) {
  return ranges.some((range) => new Date(range.start_at_utc) < end && new Date(range.end_at_utc) > start)
}

export function generateSlots(
  startDate: string,
  days: number,
  teacherTimezone: string,
  viewerTimezone: string,
  lessonMinutes: number,
  availability: Availability[],
  blocked: BlockedPeriod[],
  bookings: Booking[],
  now = new Date(),
): BookingSlot[] {
  const result: BookingSlot[] = []
  const base = new Date(`${startDate}T00:00:00Z`)
  for (let day = 0; day < days; day += 1) {
    const date = new Date(base.getTime() + day * 86400000)
    const localDate = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    const weekday = date.getUTCDay()
    for (const rule of availability.filter((item) => item.enabled && item.weekday === weekday)) {
      if (rule.effective_from && localDate < rule.effective_from) continue
      if (rule.effective_until && localDate > rule.effective_until) continue
      const [startHour, startMinute] = rule.local_start_time.slice(0, 5).split(':').map(Number)
      const [endHour, endMinute] = rule.local_end_time.slice(0, 5).split(':').map(Number)
      const startTotal = startHour * 60 + startMinute
      const endTotal = endHour * 60 + endMinute
      for (let minutes = startTotal; minutes + lessonMinutes <= endTotal; minutes += lessonMinutes) {
        const localStart = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
        const localEndTotal = minutes + lessonMinutes
        const localEnd = `${pad(Math.floor(localEndTotal / 60))}:${pad(localEndTotal % 60)}`
        const start = localDateTimeToUtc(localDate, localStart, teacherTimezone)
        const end = localDateTimeToUtc(localDate, localEnd, teacherTimezone)
        if (start <= now) continue
        const unavailable = overlaps(start, end, [...blocked, ...bookings.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))])
        result.push({ startAtUtc: start.toISOString(), endAtUtc: end.toISOString(), localDate, localStart, localEnd, viewerStart: formatViewerTime(start.toISOString(), viewerTimezone), viewerEnd: formatViewerTime(end.toISOString(), viewerTimezone), available: !unavailable })
      }
    }
  }
  return result.sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc))
}
