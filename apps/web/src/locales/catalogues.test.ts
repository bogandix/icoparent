import en from "@/locales/en/common.json"
import ro from "@/locales/ro/common.json"
import { describe, expect, it } from "vitest"

function leafKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix]
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix.length > 0 ? `${prefix}.${key}` : key),
  )
}

describe("locale catalogues", () => {
  it("has the same keys in English and Romanian", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(ro).sort())
  })
})
