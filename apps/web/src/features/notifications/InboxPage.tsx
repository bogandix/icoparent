import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { linkRowClass, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth"
import { useFamily } from "@/lib/family"
import { rpc } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

type Notice = {
  id: string
  type: string
  link: string | null
  payload: Record<string, string | number>
  read_at: string | null
  created_at: string
}

export function InboxPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const { family } = useFamily()
  const queryClient = useQueryClient()
  const notices = useQuery({
    queryKey: ["notifications", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as Notice[]
    },
  })

  useEffect(() => {
    if (!session?.user.id) return
    const channel = supabase
      .channel(`notifications-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${session.user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["notifications", session.user.id] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, session?.user.id])

  const unread = (notices.data ?? []).filter((notice) => notice.read_at == null).length

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>
        {t("inbox.title")} ({unread})
      </PageTitle>
      <Button
        type="button"
        variant="outline"
        onClick={() => void rpc("mark_all_notifications_read", { p_family_id: family?.id })}
      >
        {t("inbox.markAll")}
      </Button>
      {(notices.data ?? []).length === 0 ? <p>{t("inbox.empty")}</p> : null}
      <ul className="flex flex-col gap-3">
        {(notices.data ?? []).map((notice) => (
          <li key={notice.id} className="rounded-md border border-border p-3">
            <p>
              {t(`inbox.types.${notice.type}`, {
                title: String(notice.payload.title ?? ""),
                defaultValue: String(notice.payload.title ?? notice.type),
              })}
            </p>
            {notice.link ? (
              <Link to={notice.link} className={linkRowClass}>
                {t("inbox.open")}
              </Link>
            ) : null}
            {notice.read_at == null ? (
              <Button type="button" variant="ghost" onClick={() => void rpc("mark_notification_read", { p_id: notice.id })}>
                {t("inbox.markRead")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
