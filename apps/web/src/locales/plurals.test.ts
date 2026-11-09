import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n"

describe("Romanian plurals", () => {
  it("uses one, few, and other", async () => {
    await i18n.changeLanguage("ro")
    expect(i18n.t("itemCount", { count: 1 })).toBe("1 element")
    expect(i18n.t("itemCount", { count: 2 })).toBe("2 elemente")
    expect(i18n.t("itemCount", { count: 20 })).toBe("20 de elemente")
  })
})
