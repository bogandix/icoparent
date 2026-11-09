import { describe, expect, it } from "vitest"
import { slotFromElement } from "./calendar-slot"

function element(html: string): Element {
  const root = document.createElement("div")
  root.innerHTML = html
  return root.firstElementChild as Element
}

describe("slotFromElement", () => {
  it("uses a one-hour morning slot for a day cell", () => {
    const day = element('<div data-date="2026-11-09"><span></span></div>').querySelector("span")
    expect(slotFromElement(day)).toEqual({
      starts: "2026-11-09T09:00",
      ends: "2026-11-09T10:00",
      label: "2026-11-09",
    })
  })

  it("starts at the time-grid slot and lasts one hour", () => {
    const slot = element('<div data-date="2026-11-09"><div data-time="16:00:00"><span></span></div></div>')
      .querySelector("span")
    expect(slotFromElement(slot)?.starts).toBe("2026-11-09T16:00")
    expect(slotFromElement(slot)?.ends).toBe("2026-11-09T17:00")
  })

  it("rolls an hour past midnight onto the next day", () => {
    const slot = element('<div data-date="2026-11-09" data-time="23:30:00"></div>')
    expect(slotFromElement(slot)?.ends).toBe("2026-11-10T00:30")
  })

  it("prefers the event under the pointer", () => {
    const event = element(
      '<div data-date="2026-11-09"><div data-quick-start="2026-11-09T18:00" data-quick-end="2026-11-09T19:00" data-quick-title="Football practice"></div></div>',
    ).firstElementChild
    expect(slotFromElement(event)).toEqual({
      starts: "2026-11-09T18:00",
      ends: "2026-11-09T19:00",
      label: "Football practice",
    })
  })

  it("ignores a press that is not on a day", () => {
    expect(slotFromElement(element("<button>Today</button>"))).toBeNull()
  })
})
