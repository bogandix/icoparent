import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth"
import { useFamily } from "@/lib/family"
import { formatDateTime } from "@/lib/format"
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
  const { t, i18n } = useTranslation()
  const { session } = useSession()
  const { family } = useFamily()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const notices = useQuery({
    queryKey: ["notifications", userId, "list"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as Notice[]
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] })
  const items = notices.data ?? []
  const unread = items.filter((notice) => notice.read_at == null).length

  async function open(notice: Notice) {
    if (notice.read_at == null) {
      await rpc("mark_notification_read", { p_id: notice.id }).catch(() => undefined)
      void refresh()
    }
    if (notice.link) void navigate(notice.link)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>{t("inbox.title")}</PageTitle>
      {unread > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void rpc("mark_all_notifications_read", { p_family_id: family?.id }).then(refresh)
          }
        >
          {t("inbox.markAll")} ({unread})
        </Button>
      ) : null}
      {notices.isSuccess && items.length === 0 ? (
        <p className="text-muted-foreground">{t("inbox.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((notice) => {
          const isUnread = notice.read_at == null
          return (
            <li key={notice.id}>
              <button
                type="button"
                onClick={() => void open(notice)}
                className={`flex w-full min-h-14 items-start gap-3 rounded-lg border px-3 py-2 text-left active:bg-accent ${isUnread ? "border-primary/40 bg-accent/60" : "border-border"}`}
              >
                <span
                  aria-hidden
                  className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-primary" : "bg-transparent"}`}
                />
                <span className="flex flex-col">
                  <span className={isUnread ? "font-medium" : ""}>
                    {t(`inbox.types.${notice.type}`, {
                      title: String(notice.payload.title ?? ""),
                      defaultValue: String(notice.payload.title ?? notice.type),
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(notice.created_at, i18n.language, family?.timezone || "UTC")}
                    {isUnread ? ` · ${t("inbox.unread")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
