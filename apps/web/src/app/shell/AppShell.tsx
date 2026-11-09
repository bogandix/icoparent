import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet } from "react-router"
import { useFamily } from "@/lib/family"
import { i18n } from "@/lib/i18n"
import { useKeyboardOpen } from "@/lib/platform"
import { supabase } from "@/lib/supabase"

const headerAction =
  "inline-flex min-h-11 items-center justify-center rounded-md px-2 text-sm active:bg-accent"

const parentLinks = [
  { to: "/", key: "shell.today", end: true },
  { to: "/calendar", key: "shell.calendar", end: false },
  { to: "/agreements", key: "shell.agreements", end: false },
  { to: "/money", key: "shell.money", end: false },
  { to: "/feed", key: "shell.feed", end: false },
  { to: "/more", key: "shell.more", end: false },
] as const

const childLinks = [
  { to: "/", key: "shell.today", end: true },
  { to: "/calendar", key: "shell.calendar", end: false },
  { to: "/feed", key: "shell.feed", end: false },
  { to: "/more", key: "shell.more", end: false },
] as const

export function AppShell() {
  const { t } = useTranslation()
  const keyboard = useKeyboardOpen()
  const { me, family, members, setFamilyId } = useFamily()
  const [dark, setDark] = useState(localStorage.getItem("icoparent.theme") === "dark")
  const links = me?.role === "child" ? childLinks : parentLinks
  const families = [...new Map(members.map((member) => [member.family_id, member])).values()]

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("icoparent.theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border p-4 lg:block">
        <p className="px-3 text-sm font-medium text-muted-foreground">{family?.name}</p>
        <nav className="mt-4 flex flex-col gap-1" aria-label={t("shell.today")}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent text-accent-foreground" : ""}`
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-1 border-b border-border bg-background px-3 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <label className="min-w-0 flex-1 basis-36 text-base">
            <span className="sr-only">{family?.name}</span>
            <select
              className="h-11 w-full truncate bg-transparent font-medium"
              value={family?.id ?? ""}
              onChange={(event) => setFamilyId(event.target.value)}
            >
              {families.map((member) => (
                <option key={member.family_id} value={member.family_id}>
                  {family?.id === member.family_id ? family.name : member.display_name}
                </option>
              ))}
            </select>
          </label>
          <NavLink to="/inbox" className={headerAction}>
            {t("shell.inbox")}
          </NavLink>
          <button type="button" className={headerAction} onClick={() => setDark((value) => !value)}>
            {dark ? t("shell.themeLight") : t("shell.themeDark")}
          </button>
          <button
            type="button"
            className={`${headerAction} min-w-11`}
            onClick={() => {
              const next = i18n.language.startsWith("ro") ? "en" : "ro"
              void i18n.changeLanguage(next)
              if (me) {
                void supabase.rpc("update_my_profile", {
                  p_display_name: me.display_name,
                  p_locale: next,
                })
              }
            }}
          >
            {i18n.language.startsWith("ro") ? "EN" : "RO"}
          </button>
        </header>
        <div
          className={
            keyboard
              ? "flex-1 px-4 py-4"
              : "flex-1 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6"
          }
        >
          <Outlet />
        </div>
        <nav
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden ${keyboard ? "hidden" : ""}`}
          aria-label={t("shell.today")}
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex min-h-12 items-center justify-center px-0.5 py-1 text-center text-[11px] leading-tight ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`
                }
              >
                <span className="line-clamp-2">{t(link.key)}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
