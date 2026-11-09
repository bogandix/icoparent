import { useTranslation } from "react-i18next"
import { Navigate, Outlet, useLocation } from "react-router"
import { useSession } from "@/lib/auth"
import { useFamily } from "@/lib/family"

export function RequireSession() {
  const { t } = useTranslation()
  const { session, ready } = useSession()
  if (!ready) return <p className="p-6">{t("shell.loading")}</p>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireFamily() {
  const { t } = useTranslation()
  const { family, loading, me } = useFamily()
  const location = useLocation()
  if (loading) return <p className="p-6">{t("shell.loading")}</p>
  if (!family || !me) return <Navigate to="/onboarding" replace />
  if (
    me.role === "child" &&
    (location.pathname.startsWith("/money") || location.pathname.startsWith("/agreements"))
  ) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
