import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { linkRowClass, PageTitle } from "@/components/Field"
import { Badge, Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { useFlash } from "@/lib/flash"
import { formatDateTime, formatTime } from "@/lib/format"
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

type CheckinKind = "dropoff" | "pickup" | "confirm"

const quickActionClass =
  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-3 text-center text-sm font-medium active:bg-accent"

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const { family, members, me } = useFamily()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [checkinNotice, setCheckinNotice] = useState<string | null>(null)
  const isParent = me?.role === "parent"
  const timeZone = family?.timezone || "UTC"
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
        events: { id: string; title: string; starts_at: string; status: string }[]
        handovers: Handover[]
      }>("calendar_range", {
        p_family: family?.id,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
  })

  const proposals = useQuery({
    queryKey: ["proposals", family?.id, "pending"],
    enabled: Boolean(family?.id) && isParent,
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
    mutationFn: async (input: { id: string; kind: CheckinKind }) =>
      rpc("checkin", {
        p_handover_id: input.id,
        p_kind: input.kind,
        p_lat: null,
        p_lng: null,
        p_note: null,
      }),
    onSuccess: () => {
      setCheckinNotice(
        t("handover.saved", {
          time: formatTime(new Date().toISOString(), i18n.language, timeZone),
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ["calendar", family?.id] })
    },
  })

  const nameById = new Map(members.map((member) => [member.id, member.display_name]))
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())
  const custodyToday = range.data?.custody.find((day) => day.date === todayKey)
  const parentName = custodyToday?.parent_member_id
    ? nameById.get(custodyToday.parent_member_id)
    : null
  const nextHandover = range.data?.handovers.find(
    (item) => item.status === "scheduled" || item.status === "in_progress",
  )
  const waiting = (proposals.data ?? []).filter((item) => item.created_by !== me?.id)
  const events = (range.data?.events ?? []).filter((event) => event.status !== "voided")

  // Only offer the check-ins that belong to this parent's side of the handover.
  const myCheckins: CheckinKind[] =
    !nextHandover || !me
      ? []
      : me.id === nextHandover.from_parent_id
        ? ["dropoff"]
        : me.id === nextHandover.to_parent_id
          ? ["pickup", "confirm"]
          : []

  const quickActions = isParent
    ? [
        { to: "/money/new", label: t("money.add") },
        { to: "/calendar#new-event", label: t("calendar.addEvent") },
        { to: "/agreements/new", label: t("agreements.new") },
        { to: "/feed", label: t("feed.new") },
      ]
    : [
        { to: "/calendar", label: t("shell.calendar") },
        { to: "/feed", label: t("feed.new") },
      ]

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageTitle>{t("shell.today")}</PageTitle>
      {flash ? <Notice>{flash}</Notice> : null}

      {parentName ? (
        <p className="rounded-lg bg-accent px-4 py-3 text-base font-medium">
          {t("calendar.kidsWith", { name: parentName })}
        </p>
      ) : null}

      {nextHandover ? (
        <section
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
          aria-labelledby="next-handover"
        >
          <h2 id="next-handover" className="font-medium">
            {t("handover.next")}
          </h2>
          <p>
            {formatDateTime(nextHandover.scheduled_at, i18n.language, timeZone)}
            <br />
            <span className="text-muted-foreground">
              {nameById.get(nextHandover.from_parent_id)} →{" "}
              {nameById.get(nextHandover.to_parent_id)}
              {nextHandover.location ? ` · ${nextHandover.location}` : ""}
            </span>
          </p>
          {isParent && myCheckins.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {myCheckins.map((kind, index) => (
                <Button
                  key={kind}
                  type="button"
                  size="lg"
                  variant={index === 0 ? "default" : "outline"}
                  disabled={checkin.isPending}
                  onClick={() => checkin.mutate({ id: nextHandover.id, kind })}
                >
                  {t(`handover.${kind}`)}
                </Button>
              ))}
            </div>
          ) : null}
          {checkinNotice ? <Notice>{checkinNotice}</Notice> : null}
          {checkin.error ? (
            <Notice tone="error">{t(`errors.${errorCode(checkin.error)}`)}</Notice>
          ) : null}
        </section>
      ) : null}

      {isParent && waiting.length > 0 ? (
        <section className="flex flex-col gap-1 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-medium">
            {t("agreements.waitingForMe")} <Badge>{waiting.length}</Badge>
          </h2>
          {waiting.map((item) => (
            <Link key={item.id} to={`/agreements/${item.id}`} className={linkRowClass}>
              {item.title} →
            </Link>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="font-medium">
          {t("home.quick")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className={quickActionClass}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">{t("home.upcoming")}</h2>
        {events.map((event) => (
          <Link key={event.id} to="/calendar" className={`${linkRowClass} gap-3`}>
            <span className="w-28 shrink-0 text-sm text-muted-foreground">
              {formatDateTime(event.starts_at, i18n.language, timeZone)}
            </span>
            <span>{event.title}</span>
          </Link>
        ))}
        {range.isSuccess && events.length === 0 ? (
          <p className="text-muted-foreground">{t("shell.empty")}</p>
        ) : null}
      </section>

      {memory.data?.body ? (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium">{t("shell.feed")}</h2>
          <Link to="/feed" className="rounded-lg border border-border p-3 active:bg-accent">
            {memory.data.body}
          </Link>
        </section>
      ) : null}

      <BuildLabel />
    </div>
  )
}

function BuildLabel() {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(__BUILD_TIME__))
  return (
    <p className="pt-4 text-center text-xs text-muted-foreground" data-testid="build-label">
      {t("home.build", { date, commit: __BUILD_COMMIT__ })}
    </p>
  )
}
