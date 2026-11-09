import { describe, expect, it } from "vitest"
import { assertProductionAuthMode } from "./production-auth"

describe("assertProductionAuthMode", () => {
  it("rejects local sign-in in a production build", () => {
    expect(() => assertProductionAuthMode("production", "local")).toThrow(/VITE_AUTH_MODE=local/)
  })

  it("allows local sign-in during development and production Google sign-in", () => {
    expect(() => assertProductionAuthMode("development", "local")).not.toThrow()
    expect(() => assertProductionAuthMode("production", undefined)).not.toThrow()
  })
})
