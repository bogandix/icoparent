import { describe, expect, it } from "vitest"
import { formatMoney } from "./money"

describe("formatMoney", () => {
  it("formats minor units for Romanian and English", () => {
    const romanian = formatMoney(123450, "RON", "ro-RO")
    expect(romanian).toMatch(/1\.234,50/)
    expect(romanian.toLowerCase()).toMatch(/lei|ron/)

    const english = formatMoney(123450, "RON", "en-US")
    expect(english).toMatch(/1,234\.50/)
  })
})
