import { describe, expect, it } from "vitest"
import { expandRecurrence } from "./recurrence"

describe("expandRecurrence", () => {
  it("expands a weekly event until the end date", () => {
    const starts = new Date("2026-01-05T15:00:00Z")
    const ends = new Date("2026-01-05T16:00:00Z")
    const dates = expandRecurrence(
      starts,
      ends,
      "FREQ=WEEKLY;UNTIL=20260126",
      new Date("2026-02-01T00:00:00Z"),
    )
    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ])
  })
})
