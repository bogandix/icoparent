import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"

/**
 * A one-time message carried across navigation, e.g. "Expense saved" after a form
 * returns to its list. Cleared from history so a refresh does not show it again.
 */
export function useFlash(): string | null {
  const location = useLocation()
  const navigate = useNavigate()
  const [flash] = useState<string | null>(() => {
    const state = location.state as { flash?: unknown } | null
    return typeof state?.flash === "string" ? state.flash : null
  })

  useEffect(() => {
    if (flash) void navigate(location.pathname + location.search, { replace: true, state: null })
    // Only on mount: clear the state once it has been read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return flash
}
