export type Recurrence = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY"
  until: string
}

const freqs = new Set(["DAILY", "WEEKLY", "MONTHLY"])

export function parseRRule(rule: string | null): Recurrence | null {
  if (!rule) return null
  const freq = /FREQ=(DAILY|WEEKLY|MONTHLY)/.exec(rule)?.[1]
  const until = /UNTIL=(\d{8})/.exec(rule)?.[1]
  if (!freq || !until || !freqs.has(freq)) return null
  return { freq: freq as Recurrence["freq"], until }
}

export function buildRRule(freq: Recurrence["freq"], until: string): string {
  return `FREQ=${freq};UNTIL=${until.replaceAll("-", "")}`
}

export function expandRecurrence(
  startsAt: Date,
  endsAt: Date,
  rule: string | null,
  rangeEnd: Date,
): Date[] {
  const parsed = parseRRule(rule)
  if (!parsed) return [startsAt]
  const until = new Date(
    `${parsed.until.slice(0, 4)}-${parsed.until.slice(4, 6)}-${parsed.until.slice(6, 8)}T23:59:59Z`,
  )
  const duration = endsAt.getTime() - startsAt.getTime()
  const dates: Date[] = []
  const cursor = new Date(startsAt)
  while (cursor <= until && cursor <= rangeEnd && dates.length < 370) {
    dates.push(new Date(cursor))
    if (parsed.freq === "DAILY") cursor.setUTCDate(cursor.getUTCDate() + 1)
    else if (parsed.freq === "WEEKLY") cursor.setUTCDate(cursor.getUTCDate() + 7)
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    void duration
  }
  return dates
}
