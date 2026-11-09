import { describe, expect, it } from "vitest"
import { detectLocale } from "./locale"

describe("detectLocale", () => {
  it("uses English when the browser has no Romanian preference", () => {
    expect(detectLocale(["en-US", "en"])).toBe("en")
    expect(detectLocale(["fr-FR"])).toBe("en")
    expect(detectLocale([])).toBe("en")
  })

  it("uses Romanian when any preferred language is Romanian", () => {
    expect(detectLocale(["ro-RO"])).toBe("ro")
    expect(detectLocale(["en-GB", "ro"])).toBe("ro")
    expect(detectLocale(["RO"])).toBe("ro")
  })
})
