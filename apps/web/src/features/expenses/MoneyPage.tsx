import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Acknowledge } from "@/features/calendar/CalendarPages"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { useFlash } from "@/lib/flash"
import { formatDay, parseAmountMinor } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { rpc } from "@/lib/rpc"
import { uploadImage } from "@/lib/storage"
import { supabase } from "@/lib/supabase"

const categories = [
  "school",
  "clothes",
  "health",
  "activities",
  "toys",
  "trips",
  "food",
  "other",
] as const

type Expense = {
  id: string
  title: string
  category: string
  amount_minor: number
  currency: string
  spent_on: string
  paid_by_member_id: string | null
  created_by: string
  status: string
  version: number
  supersedes_id: string | null
  note: string | null
  merchant: string | null
  decision_proposal_id: string | null
  expense_children?: { child_member_id: string }[] | null
}

export function MoneyPage() {
  const { t, i18n } = useTranslation()
  const { family, members, me } = useFamily()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [category, setCategory] = useState("")
  const [childId, setChildId] = useState("")
  const expenses = useQuery({
    queryKey: ["expenses", family?.id],
    enabled: Boolean(family?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_children(child_member_id)")
        .eq("family_id", family?.id ?? "")
        .is("superseded_by", null)
        .order("spent_on", { ascending: false })
      if (error) throw error
      return (data ?? []) as Expense[]
    },
  })
  const currency = family?.default_currency.trim() ?? "RON"
  const month = new Date().toISOString().slice(0, 7)
  const names = new Map(members.map((member) => [member.id, member.display_name]))
  const children = members.filter((member) => member.role === "child")
  const rows = (expenses.data ?? []).filter((row) => row.status === "recorded")
  const visible = rows.filter((row) => {
    if (category && row.category !== category) return false
    if (!childId) return true
    return (row.expense_children ?? []).some((link) => link.child_member_id === childId)
  })
  const totals = new Map<string, number>()
  for (const row of visible.filter((row) => row.spent_on.startsWith(month))) {
    const key = row.paid_by_member_id ?? row.created_by
    totals.set(key, (totals.get(key) ?? 0) + row.amount_minor)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>{t("shell.money")}</PageTitle>
      {flash ? <Notice>{flash}</Notice> : null}
      <Button asChild size="lg">
        <Link to="/money/new">{t("money.add")}</Link>
      </Button>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-medium">{t("money.monthTotal")}</h2>
        {totals.size === 0 ? <p className="text-muted-foreground">{t("shell.empty")}</p> : null}
        {[...totals.entries()].map(([memberId, amount]) => (
          <p key={memberId} className="flex justify-between">
            <span>{names.get(memberId)}</span>
            <span className="font-medium tabular-nums">
              {formatMoney(amount, currency, i18n.language)}
            </span>
          </p>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("money.category")}>
          <select
            className={controlClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("calendar.everyone")}</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {t(`money.${item}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("calendar.filterChild")}>
          <select
            className={controlClass}
            value={childId}
            onChange={(event) => setChildId(event.target.value)}
          >
            <option value="">{t("calendar.everyone")}</option>
            {children.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {expenses.isSuccess && visible.length === 0 ? (
        <p className="text-muted-foreground">{t("shell.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {visible.map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-3">
            <Link
              to={`/money/${row.id}`}
              className="flex items-start justify-between gap-3 active:opacity-70"
            >
              <span className="flex flex-col">
                <span className="font-medium">{row.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatDay(row.spent_on, i18n.language)} · {t(`money.${row.category}`)}
                  {row.paid_by_member_id ? ` · ${names.get(row.paid_by_member_id) ?? ""}` : ""}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}
              </span>
            </Link>
            {me?.role === "parent" && me.id !== row.created_by ? (
              <Acknowledge
                subjectType="expense"
                subjectId={row.id}
                authorId={row.created_by}
                onDone={() =>
                  void queryClient.invalidateQueries({ queryKey: ["expenses", family?.id] })
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExpenseFormPage() {
  const { t } = useTranslation()
  const { family, members, me } = useFamily()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const parents = members.filter((member) => member.role === "parent")
  const children = members.filter((member) => member.role === "child")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<(typeof categories)[number]>("other")
  const [spentOn, setSpentOn] = useState(() => new Date().toISOString().slice(0, 10))
  // Empty / null mean "not chosen yet": default to me and to every child, even if members load late.
  const [paidByChoice, setPaidBy] = useState("")
  const paidBy = paidByChoice || me?.id || ""
  const [childChoice, setChildIds] = useState<string[] | null>(null)
  const childIds = childChoice ?? children.map((child) => child.id)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggleChild(id: string) {
    setChildIds(
      childIds.includes(id) ? childIds.filter((value) => value !== id) : [...childIds, id],
    )
  }

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const minor = parseAmountMinor(amount)
        if (minor == null) {
          setMessage(t("money.invalidAmount"))
          return
        }
        setBusy(true)
        setMessage(null)
        void rpc("create_expense", {
          p_family_id: family?.id,
          p_category: category,
          p_title: title.trim(),
          p_amount_minor: minor,
          p_currency: family?.default_currency ?? "RON",
          p_original_amount_minor: null,
          p_original_currency: null,
          p_spent_on: spentOn,
          p_merchant: null,
          p_note: note.trim() || null,
          p_paid_by: paidBy || me?.id,
          p_child_ids: childIds,
          p_decision_proposal_id: params.get("decision"),
        })
          .then(async () => {
            await queryClient.invalidateQueries({ queryKey: ["expenses", family?.id] })
            void navigate("/money", { state: { flash: t("money.saved") } })
          })
          .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
          .finally(() => setBusy(false))
      }}
    >
      <PageTitle>{t("money.add")}</PageTitle>
      <Field label={t("calendar.title")}>
        <input
          className={controlClass}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`${t("money.amount")} (${family?.default_currency.trim() ?? "RON"})`}>
          <input
            className={controlClass}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>
        <Field label={t("money.spentOn")}>
          <input
            className={controlClass}
            type="date"
            value={spentOn}
            onChange={(event) => setSpentOn(event.target.value)}
            required
          />
        </Field>
      </div>
      <Field label={t("money.category")}>
        <select
          className={controlClass}
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {t(`money.${item}`)}
            </option>
          ))}
        </select>
      </Field>
      {parents.length > 1 ? (
        <Field label={t("money.paidBy")}>
          <select
            className={controlClass}
            value={paidBy}
            onChange={(event) => setPaidBy(event.target.value)}
          >
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.display_name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {children.length > 0 ? (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="font-medium">{t("money.children")}</legend>
          <div className="flex flex-wrap gap-2 pt-1">
            {children.map((child) => {
              const on = childIds.includes(child.id)
              return (
                <button
                  key={child.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleChild(child.id)}
                  className={`min-h-11 rounded-full border px-4 text-base ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {child.display_name}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}
      <Field label={t("money.note")}>
        <textarea
          className={controlClass}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        {t("shell.save")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => void navigate(-1)}>
        {t("shell.cancel")}
      </Button>
      {message ? <Notice tone="error">{message}</Notice> : null}
    </form>
  )
}

export function ExpenseDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const { family, members } = useFamily()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const expense = useQuery({
    queryKey: ["expense", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", id ?? "")
        .single()
      if (error) throw error
      return data as Expense
    },
  })
  const history = useQuery({
    queryKey: ["expense-history", expense.data?.supersedes_id],
    enabled: Boolean(expense.data?.supersedes_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expense.data?.supersedes_id ?? "")
        .single()
      if (error) throw error
      return data as Expense
    },
  })
  const row = expense.data
  if (!row) return <p>{t("shell.loading")}</p>
  const payer = members.find((member) => member.id === row.paid_by_member_id)?.display_name
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <Link to="/money" className="text-sm text-muted-foreground">
        ← {t("shell.money")}
      </Link>
      <PageTitle>{row.title}</PageTitle>
      <p className="text-2xl font-semibold tabular-nums">
        {formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}
      </p>
      <p className="text-muted-foreground">
        {formatDay(row.spent_on, i18n.language)} · {t(`money.${row.category}`)}
        {payer ? ` · ${t("money.paidBy")}: ${payer}` : ""}
      </p>
      {row.note ? <p>{row.note}</p> : null}
      {row.status === "voided" ? (
        <p className="text-sm text-muted-foreground">{t("money.voided")}</p>
      ) : (
        <Acknowledge
          subjectType="expense"
          subjectId={row.id}
          authorId={row.created_by}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ["expense", id] })
            void queryClient.invalidateQueries({ queryKey: ["expenses", family?.id] })
          }}
        />
      )}
      {history.data ? (
        <p className="text-sm text-muted-foreground">
          {t("money.history")}:{" "}
          {formatMoney(history.data.amount_minor, history.data.currency.trim(), i18n.language)}
        </p>
      ) : null}
      <Field label={t("money.receipt")}>
        <input
          className={controlClass}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file || !family) return
            setUploading(true)
            setMessage(null)
            void uploadImage(file, { familyId: family.id, ownerType: "expense", ownerId: row.id })
              .then(async () => {
                await queryClient.invalidateQueries({ queryKey: ["expense", id] })
                setMessage({ tone: "success", text: t("money.receiptSaved") })
              })
              .catch((error: unknown) =>
                setMessage({ tone: "error", text: t(`errors.${errorCode(error)}`) }),
              )
              .finally(() => setUploading(false))
          }}
        />
      </Field>
      {uploading ? <p className="text-sm text-muted-foreground">{t("shell.loading")}</p> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  )
}
