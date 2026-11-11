import { describe, expect, it } from "vitest"
import { formatDay, parseAmountMinor } from "./format"

describe("parseAmountMinor", () => {
  it("accepts comma and dot decimals", () => {
    expect(parseAmountMinor("12,50")).toBe(1250)
    expect(parseAmountMinor("12.5")).toBe(1250)
    expect(parseAmountMinor(" 1 200 ")).toBe(120000)
  })

  it("rejects empty, zero, negative and malformed amounts", () => {
    expect(parseAmountMinor("")).toBeNull()
    expect(parseAmountMinor("0")).toBeNull()
    expect(parseAmountMinor("-5")).toBeNull()
    expect(parseAmountMinor("12.345")).toBeNull()
    expect(parseAmountMinor("abc")).toBeNull()
  })
})

describe("formatDay", () => {
  it("does not shift a plain date across timezones", () => {
    expect(formatDay("2026-03-01", "en-GB")).toContain("1")
    expect(formatDay("2026-03-01", "en-GB")).toContain("2026")
  })
})
