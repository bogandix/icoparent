import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Badge, Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { useFlash } from "@/lib/flash"
import { formatDateTime, parseAmountMinor } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { rpc } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

type Proposal = {
  id: string
  kind: "blocker_request" | "custody_swap" | "decision" | "event_change"
  title: string
  body: string | null
  status: string
  created_by: string
  amount_minor: number | null
  currency: string | null
  expires_at: string
  payload: Record<string, unknown>
  parent_proposal_id: string | null
}

const statusTone: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  accepted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {t(`agreements.status.${status}`, { defaultValue: status })}
    </span>
  )
}

export function AgreementsPage() {
  const { t } = useTranslation()
  const { family, me } = useFamily()
  const flash = useFlash()
  const proposals = useQuery({
    queryKey: ["proposals", family?.id],
    enabled: Boolean(family?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("family_id", family?.id ?? "")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as Proposal[]
    },
  })
  const rows = proposals.data ?? []
  const groups = {
    waitingForMe: rows.filter((row) => row.status === "pending" && row.created_by !== me?.id),
    waitingForThem: rows.filter((row) => row.status === "pending" && row.created_by === me?.id),
    history: rows.filter((row) => row.status !== "pending"),
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageTitle>{t("shell.agreements")}</PageTitle>
      {flash ? <Notice>{flash}</Notice> : null}
      <Button asChild size="lg">
        <Link to="/agreements/new">{t("agreements.new")}</Link>
      </Button>
      {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => {
        const items = groups[key]
        if (key === "history" && items.length === 0) return null
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-medium">
              {t(`agreements.${key}`)}
              {key === "waitingForMe" && items.length > 0 ? <Badge>{items.length}</Badge> : null}
            </h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground">{t("shell.empty")}</p>
            ) : null}
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/agreements/${item.id}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 active:bg-accent"
              >
                <span className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`agreements.${item.kind}`)}
                  </span>
                </span>
                <StatusPill status={item.status} />
              </Link>
            ))}
          </section>
        )
      })}
    </div>
  )
}

export function AgreementDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const { me, family } = useFamily()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const proposal = useQuery({
    queryKey: ["proposal", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id ?? "")
        .single()
      if (error) throw error
      return data as Proposal
    },
  })
  const row = proposal.data
  if (!row) return <p>{t("shell.loading")}</p>
  const mine = row.created_by === me?.id
  const timeZone = family?.timezone || "UTC"

  async function finish(flash: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["proposals", family?.id] }),
      queryClient.invalidateQueries({ queryKey: ["proposal", id] }),
      queryClient.invalidateQueries({ queryKey: ["calendar", family?.id] }),
    ])
    void navigate("/agreements", { state: { flash } })
  }

  async function act(run: () => Promise<unknown>, flash: string) {
    setBusy(true)
    setMessage(null)
    try {
      await run()
      await finish(flash)
    } catch (error) {
      setMessage(t(`errors.${errorCode(error)}`))
    } finally {
      setBusy(false)
    }
  }

  const respond = (response: "accept" | "decline" | "counter") => {
    if (response === "counter" && comment.trim() === "") {
      setMessage(t("agreements.counterNeedsNote"))
      return
    }
    void act(
      () =>
        rpc("respond_to_proposal", {
          p_id: row.id,
          p_response: response,
          p_comment: comment,
          p_counter: response === "counter" ? { title: row.title, body: comment } : null,
        }),
      t("agreements.responded"),
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link to="/agreements" className="text-sm text-muted-foreground">
        ← {t("shell.agreements")}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <PageTitle>{row.title}</PageTitle>
        <StatusPill status={row.status} />
      </div>
      <p className="text-muted-foreground">{t(`agreements.${row.kind}`)}</p>
      {row.body ? <p className="whitespace-pre-wrap">{row.body}</p> : null}
      {row.amount_minor != null && row.currency ? (
        <p className="text-xl font-semibold tabular-nums">
          {formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}
        </p>
      ) : null}
      {row.status === "pending" ? (
        <p className="text-sm text-muted-foreground">
          {t("agreements.expires", {
            date: formatDateTime(row.expires_at, i18n.language, timeZone),
          })}
        </p>
      ) : null}
      {row.status === "accepted" && row.kind === "decision" ? (
        <Button asChild variant="outline">
          <Link to={`/money/new?decision=${row.id}`}>{t("agreements.logExpense")}</Link>
        </Button>
      ) : null}
      {row.status === "pending" && !mine ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <Field label={t("agreements.comment")}>
            <textarea
              className={controlClass}
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="lg" disabled={busy} onClick={() => respond("accept")}>
              {t("agreements.accept")}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => respond("decline")}
            >
              {t("agreements.decline")}
            </Button>
          </div>
          {row.parent_proposal_id == null ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => respond("counter")}
            >
              {t("agreements.counter")}
            </Button>
          ) : null}
        </section>
      ) : null}
      {row.status === "pending" && mine ? (
        <>
          <p className="text-sm text-muted-foreground">{t("agreements.waitingHelp")}</p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act(() => rpc("withdraw_proposal", { p_id: row.id }), t("agreements.withdrawn"))
            }
          >
            {t("agreements.withdraw")}
          </Button>
        </>
      ) : null}
      {message ? <Notice tone="error">{message}</Notice> : null}
    </div>
  )
}

const proposalKinds = ["decision", "blocker_request", "custody_swap", "event_change"] as const

function proposalKind(value: string | null): Proposal["kind"] {
  return proposalKinds.includes(value as Proposal["kind"])
    ? (value as Proposal["kind"])
    : "decision"
}

export function NewAgreementPage() {
  const { t, i18n } = useTranslation()
  const { family, members, me } = useFamily()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<Proposal["kind"]>(() => proposalKind(params.get("kind")))
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [amount, setAmount] = useState("")
  const [starts, setStarts] = useState(params.get("starts") ?? "")
  const [ends, setEnds] = useState(params.get("ends") ?? "")
  const [eventId, setEventId] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const otherParent = members.find((member) => member.role === "parent" && member.id !== me?.id)
  const timeZone = family?.timezone || "UTC"

  // Upcoming events the other parent created, so an event change is picked, not typed as an ID.
  const upcoming = useQuery({
    queryKey: ["agreement-events", family?.id],
    enabled: Boolean(family?.id) && kind === "event_change",
    queryFn: async () => {
      const from = new Date()
      const to = new Date(from)
      to.setDate(to.getDate() + 90)
      const range = await rpc<{
        events: {
          id: string
          title: string
          starts_at: string
          status: string
          created_by: string
        }[]
      }>("calendar_range", {
        p_family: family?.id,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      })
      return range.events.filter(
        (event) => event.status !== "voided" && event.created_by !== me?.id,
      )
    },
  })

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        let minor: number | null = null
        if (kind === "decision" && amount.trim() !== "") {
          minor = parseAmountMinor(amount)
          if (minor == null) {
            setMessage(t("money.invalidAmount"))
            return
          }
        }
        if (
          (kind === "blocker_request" || kind === "custody_swap") &&
          starts &&
          ends &&
          new Date(ends) <= new Date(starts)
        ) {
          setMessage(t("agreements.endsBeforeStarts"))
          return
        }
        const startsAt = starts ? new Date(starts).toISOString() : null
        const endsAt = ends ? new Date(ends).toISOString() : null
        const payload =
          kind === "blocker_request"
            ? { starts_at: startsAt, ends_at: endsAt, child_ids: [] }
            : kind === "custody_swap"
              ? {
                  ranges: [
                    {
                      starts_at: startsAt,
                      ends_at: endsAt,
                      parent_member_id: otherParent?.id ?? null,
                    },
                  ],
                }
              : kind === "event_change"
                ? { event_id: eventId, patch: { title } }
                : {}
        setBusy(true)
        setMessage(null)
        void rpc("create_proposal", {
          p_family_id: family?.id,
          p_kind: kind,
          p_title: title.trim(),
          p_body: body,
          p_payload: payload,
          p_amount_minor: minor,
          p_currency: family?.default_currency ?? "RON",
        })
          .then(async () => {
            await queryClient.invalidateQueries({ queryKey: ["proposals", family?.id] })
            void navigate("/agreements", { state: { flash: t("agreements.saved") } })
          })
          .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
          .finally(() => setBusy(false))
      }}
    >
      <PageTitle>{t("agreements.new")}</PageTitle>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium">{t("agreements.kind")}</legend>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {proposalKinds.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-base ${kind === item ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {t(`agreements.${item}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">{t(`agreements.help.${kind}`)}</p>
      {kind === "event_change" ? (
        <Field label={t("agreements.pickEvent")}>
          <select
            className={controlClass}
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            required
          >
            <option value="" disabled>
              {t("agreements.pickEvent")}
            </option>
            {(upcoming.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {formatDateTime(item.starts_at, i18n.language, timeZone)} · {item.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label={kind === "event_change" ? t("agreements.newTitle") : t("calendar.title")}>
        <input
          className={controlClass}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>
      {kind === "decision" ? (
        <Field label={t("agreements.amount")}>
          <input
            className={controlClass}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
      ) : null}
      {kind === "blocker_request" || kind === "custody_swap" ? (
        <div className="grid grid-cols-1 gap-3">
          <Field label={t("calendar.starts")}>
            <input
              className={controlClass}
              type="datetime-local"
              value={starts}
              onChange={(event) => setStarts(event.target.value)}
              required
            />
          </Field>
          <Field label={t("calendar.ends")}>
            <input
              className={controlClass}
              type="datetime-local"
              value={ends}
              onChange={(event) => setEnds(event.target.value)}
              required
            />
          </Field>
          {kind === "custody_swap" && otherParent ? (
            <p className="text-sm text-muted-foreground">
              {t("agreements.otherParent")}: {otherParent.display_name}
            </p>
          ) : null}
        </div>
      ) : null}
      <Field label={t("agreements.comment")}>
        <textarea
          className={controlClass}
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        {t("agreements.send")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => void navigate(-1)}>
        {t("shell.cancel")}
      </Button>
      {message ? <Notice tone="error">{message}</Notice> : null}
    </form>
  )
}
