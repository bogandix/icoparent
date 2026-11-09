import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router"
import { controlClass, Field, linkRowClass, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
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

export function AgreementsPage() {
  const { t } = useTranslation()
  const { family, me } = useFamily()
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
    mine: rows.filter((row) => row.status === "pending" && row.created_by !== me?.id),
    theirs: rows.filter((row) => row.status === "pending" && row.created_by === me?.id),
    history: rows.filter((row) => row.status !== "pending"),
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageTitle>{t("shell.agreements")}</PageTitle>
      <Button asChild>
        <Link to="/agreements/new">{t("agreements.new")}</Link>
      </Button>
      {(
        [
          ["waitingForMe", groups.mine],
          ["waitingForThem", groups.theirs],
          ["history", groups.history],
        ] as const
      ).map(([key, items]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="font-medium">{t(`agreements.${key}`)}</h2>
          {items.length === 0 ? <p className="text-muted-foreground">{t("shell.empty")}</p> : null}
          {items.map((item) => (
            <Link key={item.id} to={`/agreements/${item.id}`} className={linkRowClass}>
              {item.title}
            </Link>
          ))}
        </section>
      ))}
    </div>
  )
}

export function AgreementDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const { me, family } = useFamily()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const proposal = useQuery({
    queryKey: ["proposal", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").eq("id", id ?? "").single()
      if (error) throw error
      return data as Proposal
    },
  })
  const row = proposal.data
  if (!row) return <p>{t("shell.loading")}</p>
  const mine = row.created_by === me?.id

  async function respond(response: "accept" | "decline" | "counter") {
    try {
      await rpc("respond_to_proposal", {
        p_id: row?.id,
        p_response: response,
        p_comment: comment,
        p_counter: response === "counter" ? { title: row?.title, body: comment } : null,
      })
      await queryClient.invalidateQueries({ queryKey: ["proposal", id] })
    } catch (error) {
      setMessage(t(`errors.${errorCode(error)}`))
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>{row.title}</PageTitle>
      <p>{t(`agreements.${row.kind}`)}</p>
      {row.body ? <p>{row.body}</p> : null}
      {row.amount_minor != null && row.currency ? (
        <p>{formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}</p>
      ) : null}
      {row.status === "accepted" && row.kind === "decision" ? (
        <Link to={`/money/new?decision=${row.id}`}>{t("agreements.logExpense")}</Link>
      ) : null}
      {row.status === "pending" && !mine ? (
        <>
          <Field label={t("agreements.comment")}>
            <textarea className={controlClass} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <Button type="button" onClick={() => void respond("accept")}>
            {t("agreements.accept")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void respond("decline")}>
            {t("agreements.decline")}
          </Button>
          {row.parent_proposal_id == null ? (
            <Button type="button" variant="outline" onClick={() => void respond("counter")}>
              {t("agreements.counter")}
            </Button>
          ) : null}
        </>
      ) : null}
      {row.status === "pending" && mine ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void rpc("withdraw_proposal", { p_id: row.id }).catch((error: unknown) =>
              setMessage(t(`errors.${errorCode(error)}`)),
            )
          }
        >
          {t("agreements.withdraw")}
        </Button>
      ) : null}
      {message ? <p role="alert">{message}</p> : null}
      <p className="text-sm text-muted-foreground">{family?.name}</p>
    </div>
  )
}

const proposalKinds = ["decision", "blocker_request", "custody_swap", "event_change"] as const

function proposalKind(value: string | null): Proposal["kind"] {
  return proposalKinds.includes(value as Proposal["kind"]) ? (value as Proposal["kind"]) : "decision"
}

export function NewAgreementPage() {
  const { t } = useTranslation()
  const { family, members, me } = useFamily()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<Proposal["kind"]>(() => proposalKind(params.get("kind")))
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [starts, setStarts] = useState(params.get("starts") ?? "")
  const [ends, setEnds] = useState(params.get("ends") ?? "")
  const [eventId, setEventId] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const otherParent = members.find((member) => member.role === "parent" && member.id !== me?.id)

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
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
        void rpc("create_proposal", {
          p_family_id: family?.id,
          p_kind: kind,
          p_title: title,
          p_body: body,
          p_payload: payload,
          p_amount_minor: null,
          p_currency: family?.default_currency ?? "RON",
        })
          .then(() => setMessage(null))
          .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
      }}
    >
      <PageTitle>{t("agreements.new")}</PageTitle>
      <Field label={t("agreements.kind")}>
        <select className={controlClass} value={kind} onChange={(event) => setKind(event.target.value as Proposal["kind"])}>
          {(["decision", "blocker_request", "custody_swap", "event_change"] as const).map((item) => (
            <option key={item} value={item}>
              {t(`agreements.${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("calendar.title")}>
        <input className={controlClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </Field>
      <Field label={t("agreements.comment")}>
        <textarea className={controlClass} value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>
      {kind === "blocker_request" || kind === "custody_swap" ? (
        <>
          <Field label={t("calendar.starts")}>
            <input className={controlClass} type="datetime-local" value={starts} onChange={(event) => setStarts(event.target.value)} required />
          </Field>
          <Field label={t("calendar.ends")}>
            <input className={controlClass} type="datetime-local" value={ends} onChange={(event) => setEnds(event.target.value)} required />
          </Field>
          {kind === "blocker_request" ? <p className="text-sm text-muted-foreground">{t("agreements.coverHelp")}</p> : null}
          {kind === "custody_swap" ? <p className="text-sm text-muted-foreground">{t("agreements.otherParent")}: {otherParent?.display_name}</p> : null}
        </>
      ) : null}
      {kind === "event_change" ? (
        <Field label={t("agreements.event")}>
          <input className={controlClass} value={eventId} onChange={(event) => setEventId(event.target.value)} required />
        </Field>
      ) : null}
      <Button type="submit">{t("shell.save")}</Button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  )
}
