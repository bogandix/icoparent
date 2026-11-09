import { useEffect, useState } from "react"

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

export type AppPlatform = "web" | "ios" | "android"

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null
  const host = window as Window & { Capacitor?: CapacitorGlobal }
  return host.Capacitor ?? null
}

/** Web until F-301 adds Capacitor. The native bridge is optional and never imported. */
export function appPlatform(): AppPlatform {
  const native = capacitor()
  if (!native?.isNativePlatform?.()) return "web"
  const name = native.getPlatform?.()
  if (name === "ios" || name === "android") return name
  return "web"
}

export function isNativePlatform(): boolean {
  return appPlatform() !== "web"
}

/**
 * OAuth return URL. Web uses the current origin.
 * F-302 replaces this with the Capacitor custom scheme before native Google sign-in.
 */
export function oauthRedirectUrl(): string {
  return window.location.origin
}

/** True while the on-screen keyboard is covering a large part of the page. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      setOpen(window.innerHeight - viewport.height > 120)
    }
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
    }
  }, [])

  return open
}
