import { eachDayOfInterval, format } from "date-fns"
import { formatInTimeZone, toZonedTime } from "date-fns-tz"

export function zonedDayKey(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd")
}

export function daysInRange(from: Date, to: Date, timeZone: string): string[] {
  const start = toZonedTime(from, timeZone)
  const end = toZonedTime(to, timeZone)
  return eachDayOfInterval({ start, end }).map((day) => format(day, "yyyy-MM-dd"))
}
