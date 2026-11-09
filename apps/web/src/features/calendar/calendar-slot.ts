export type CalendarSlot = {
  starts: string
  ends: string
  label: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function addHour(local: string): string {
  const [date, time] = local.split("T")
  if (!date || !time) return local
  const [hourText, minuteText] = time.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return local
  const total = hour * 60 + minute + 60
  const day = total >= 24 * 60 ? nextDate(date) : date
  return `${day}T${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

function nextDate(isoDate: string): string {
  const [yearText, monthText, dayText] = isoDate.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function isDay(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function isLocal(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
}

/** Reads the day, time, or event under a right-click or long press. */
export function slotFromElement(start: Element | null): CalendarSlot | null {
  const event = start?.closest<HTMLElement>("[data-quick-start]")
  const eventStart = event?.dataset.quickStart
  if (isLocal(eventStart)) {
    const eventEnd = event?.dataset.quickEnd
    return {
      starts: eventStart,
      ends: isLocal(eventEnd) ? eventEnd : addHour(eventStart),
      label: event?.dataset.quickTitle || eventStart.replace("T", " "),
    }
  }

  const day = start?.closest("[data-date]")?.getAttribute("data-date") ?? null
  if (!isDay(day)) return null
  const time = start?.closest("[data-time]")?.getAttribute("data-time") ?? ""
  const clock = /^(\d{2}):(\d{2})/.exec(time)
  if (!clock) {
    return { starts: `${day}T09:00`, ends: `${day}T10:00`, label: day }
  }
  const starts = `${day}T${clock[1]}:${clock[2]}`
  return { starts, ends: addHour(starts), label: starts.replace("T", " ") }
}
