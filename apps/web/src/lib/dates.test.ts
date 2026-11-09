import { describe, expect, it } from "vitest"
import { daysInRange, zonedDayKey } from "./dates"

describe("family timezone dates", () => {
  it("keeps every calendar day across the Europe/Bucharest spring change", () => {
    const days = daysInRange(
      new Date("2026-03-28T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
      "Europe/Bucharest",
    )
    expect(days).toEqual(["2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"])
  })

  it("labels an instant with the family calendar day", () => {
    expect(zonedDayKey(new Date("2026-03-28T23:30:00Z"), "Europe/Bucharest")).toBe("2026-03-29")
  })
})
