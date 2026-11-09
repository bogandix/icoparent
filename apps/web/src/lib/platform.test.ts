import { afterEach, describe, expect, it } from "vitest"
import { appPlatform, isNativePlatform, oauthRedirectUrl } from "./platform"

afterEach(() => {
  delete (window as Window & { Capacitor?: unknown }).Capacitor
})

describe("appPlatform", () => {
  it("stays on the web when Capacitor is not installed", () => {
    expect(appPlatform()).toBe("web")
    expect(isNativePlatform()).toBe(false)
  })

  it("reads the native platform from the Capacitor bridge", () => {
    ;(window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor =
      {
        isNativePlatform: () => true,
        getPlatform: () => "ios",
      }
    expect(appPlatform()).toBe("ios")
    expect(isNativePlatform()).toBe(true)
  })

  it("uses the current origin for OAuth until native sign-in exists", () => {
    expect(oauthRedirectUrl()).toBe(window.location.origin)
  })
})
