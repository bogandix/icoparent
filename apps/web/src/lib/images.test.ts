import { describe, expect, it } from "vitest"
import { fitWithin } from "./images"

describe("fitWithin", () => {
  it("shrinks the long edge to the limit", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it("leaves a small image unchanged", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})
