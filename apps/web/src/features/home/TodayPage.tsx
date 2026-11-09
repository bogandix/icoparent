import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { linkRowClass, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { rpc } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

type Handover = {
  id: string
  scheduled_at: string
  from_parent_id: string
  to_parent_id: string
  status: string
  location: string | null
}

export function TodayPage() {
  const { t } = useTranslation()
  const { family, members, me } = useFamily()
  const queryClient = useQueryClient()
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 2)

  const range = useQuery({
    queryKey: ["calendar", family?.id, from.toDateString()],
    enabled: Boolean(family?.id),
    queryFn: async () =>
      rpc<{
        custody: { date: string; parent_member_id: string | null }[]
        events: { id: string; title: string; starts_at: string }[]
        handovers: Handover[]
      }>("calendar_range", {
        p_family: family?.id,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
  })

  const proposals = useQuery({
    queryKey: ["proposals", family?.id],
    enabled: Boolean(family?.id) && me?.role === "parent",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id,title,status,created_by")
        .eq("family_id", family?.id ?? "")
        .eq("status", "pending")
      if (error) throw error
      return data as { id: string; title: string; status: string; created_by: string }[]
    },
  })

  const memory = useQuery({
    queryKey: ["latest-post", family?.id],
    enabled: Boolean(family?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,body,happened_on,audience")
        .eq("family_id", family?.id ?? "")
        .eq("status", "active")
        .order("happened_on", { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as { id: string; body: string | null; happened_on: string } | null
    },
  })

  const checkin = useMutation({
    mutationFn: async (input: { id: string; kind: "dropoff" | "pickup" | "confirm" }) =>
      rpc("checkin", { p_handover_id: input.id, p_kind: input.kind, p_lat: null, p_lng: null, p_note: null }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["calendar", family?.id] }),
  })

  const nameById = new Map(members.map((member) => [member.id, member.display_name]))
  const todayKey = from.toISOString().slice(0, 10)
  const custodyToday = range.data?.custody.find((day) => day.date === todayKey)
  const parentName = custodyToday?.parent_member_id ? nameById.get(custodyToday.parent_member_id) : null
  const nextHandover = range.data?.handovers.find((item) => item.status === "scheduled" || item.status === "in_progress")
  const waiting = (proposals.data ?? []).filter((item) => item.created_by !== me?.id)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageTitle>{t("shell.today")}</PageTitle>
      {parentName ? <p>{t("calendar.kidsWith", { name: parentName })}</p> : null}
      {nextHandover ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-medium">{t("handover.next")}</h2>
          <p>
            {new Date(nextHandover.scheduled_at).toLocaleString()} · {nameById.get(nextHandover.from_parent_id)} →{" "}
            {nameById.get(nextHandover.to_parent_id)}
          </p>
          {me?.role === "parent" ? (
            <div className="flex flex-wrap gap-2">
              {(["dropoff", "pickup", "confirm"] as const).map((kind) => (
                <Button key={kind} type="button" onClick={() => checkin.mutate({ id: nextHandover.id, kind })}>
                  {t(`handover.${kind}`)}
                </Button>
              ))}
            </div>
          ) : null}
          {checkin.error ? <p role="alert">{t(`errors.${errorCode(checkin.error)}`)}</p> : null}
        </section>
      ) : null}
      {me?.role === "parent" && waiting.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t("agreements.waitingForMe")}</h2>
          {waiting.map((item) => (
            <Link key={item.id} to={`/agreements/${item.id}`} className={linkRowClass}>
              {item.title}
            </Link>
          ))}
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("shell.calendar")}</h2>
        {(range.data?.events ?? []).map((event) => (
          <p key={event.id}>{event.title}</p>
        ))}
        {(range.data?.events.length ?? 0) === 0 ? <p className="text-muted-foreground">{t("shell.empty")}</p> : null}
      </section>
      {memory.data ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t("shell.feed")}</h2>
          <p>{memory.data.body}</p>
        </section>
      ) : null}
    </div>
  )
}
