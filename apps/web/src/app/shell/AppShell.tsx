import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet } from "react-router"
import { useSession } from "@/lib/auth"
import { useFamily } from "@/lib/family"
import { useKeyboardOpen } from "@/lib/platform"
import { supabase } from "@/lib/supabase"
import { applyStoredTheme } from "@/lib/theme"

type IconName = "today" | "calendar" | "agreements" | "money" | "feed" | "more" | "inbox"

// Small inline icons (no icon library): 24px stroke paths.
const iconPaths: Record<IconName, ReactNode> = {
  today: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  agreements: <path d="M5 12.5 9.5 17 19 7.5" />,
  money: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  feed: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  inbox: <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />,
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {iconPaths[name]}
    </svg>
  )
}

const parentLinks = [
  { to: "/", key: "shell.today", icon: "today", end: true },
  { to: "/calendar", key: "shell.calendar", icon: "calendar", end: false },
  { to: "/agreements", key: "shell.agreements", icon: "agreements", end: false },
  { to: "/money", key: "shell.money", icon: "money", end: false },
  { to: "/feed", key: "shell.feed", icon: "feed", end: false },
  { to: "/more", key: "shell.more", icon: "more", end: false },
] as const

const childLinks = [
  { to: "/", key: "shell.today", icon: "today", end: true },
  { to: "/calendar", key: "shell.calendar", icon: "calendar", end: false },
  { to: "/feed", key: "shell.feed", icon: "feed", end: false },
  { to: "/more", key: "shell.more", icon: "more", end: false },
] as const

/** Unread notifications, kept live with Realtime so the badge updates without a refresh. */
function useUnreadCount(): number {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const unread = useQuery({
    queryKey: ["notifications", userId, "unread"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
      if (error) throw error
      return count ?? 0
    },
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return unread.data ?? 0
}

export function AppShell() {
  const { t } = useTranslation()
  const keyboard = useKeyboardOpen()
  const { me, family } = useFamily()
  const unread = useUnreadCount()
  const links = me?.role === "child" ? childLinks : parentLinks

  useEffect(() => {
    applyStoredTheme()
  }, [])

  const inboxLabel = unread > 0 ? t("shell.inboxUnread", { count: unread }) : t("shell.inbox")

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border p-4 lg:block">
        <p className="px-3 text-sm font-medium text-muted-foreground">{family?.name}</p>
        <nav className="mt-4 flex flex-col gap-1" aria-label={t("shell.navigation")}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent font-medium text-accent-foreground" : ""}`
              }
            >
              <Icon name={link.icon} />
              {t(link.key)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
          <p className="min-w-0 flex-1 truncate py-3 font-medium">{family?.name}</p>
          <NavLink
            to="/inbox"
            aria-label={inboxLabel}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md active:bg-accent"
          >
            <Icon name="inbox" />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-5 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </NavLink>
        </header>
        <div
          className={
            keyboard
              ? "flex-1 px-4 py-4"
              : "flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6"
          }
        >
          <Outlet />
        </div>
        <nav
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden ${keyboard ? "hidden" : ""}`}
          aria-label={t("shell.navigation")}
        >
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center text-[11px] leading-tight ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`
                }
              >
                <Icon name={link.icon} />
                <span className="line-clamp-1">{t(link.key)}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
