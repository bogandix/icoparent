import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router"
import { Acknowledge } from "@/features/calendar/CalendarPages"
import { controlClass, Field, linkRowClass, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { formatMoney } from "@/lib/money"
import { rpc } from "@/lib/rpc"
import { uploadImage } from "@/lib/storage"
import { supabase } from "@/lib/supabase"

const categories = ["school", "clothes", "health", "activities", "toys", "trips", "food", "other"] as const

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
  const month = new Date().toISOString().slice(0, 7)
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
      <Button asChild>
        <Link to="/money/new">{t("money.add")}</Link>
      </Button>
      <Field label={t("money.category")}>
        <select className={controlClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">{t("calendar.everyone")}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {t(`money.${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("calendar.filterChild")}>
        <select className={controlClass} value={childId} onChange={(event) => setChildId(event.target.value)}>
          <option value="">{t("calendar.everyone")}</option>
          {members
            .filter((member) => member.role === "child")
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
        </select>
      </Field>
      <section>
        <h2 className="font-medium">{t("money.monthTotal")}</h2>
        {[...totals.entries()].map(([memberId, amount]) => (
          <p key={memberId}>
            {members.find((member) => member.id === memberId)?.display_name}:{" "}
            {formatMoney(amount, family?.default_currency.trim() ?? "RON", i18n.language)}
          </p>
        ))}
      </section>
      <ul className="flex flex-col gap-3">
        {visible.map((row) => (
          <li key={row.id} className="rounded-md border border-border p-3">
            <Link to={`/money/${row.id}`} className={linkRowClass}>
              {row.title}
            </Link>
            <p>{formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}</p>
            {me?.role === "parent" ? (
              <Acknowledge subjectType="expense" subjectId={row.id} authorId={row.created_by} onDone={() => undefined} />
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
  const [params] = useSearchParams()
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<(typeof categories)[number]>("other")
  const [message, setMessage] = useState<string | null>(null)

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const minor = Math.round(Number(amount.replace(",", ".")) * 100)
        void rpc("create_expense", {
          p_family_id: family?.id,
          p_category: category,
          p_title: title,
          p_amount_minor: minor,
          p_currency: family?.default_currency ?? "RON",
          p_original_amount_minor: null,
          p_original_currency: null,
          p_spent_on: new Date().toISOString().slice(0, 10),
          p_merchant: null,
          p_note: null,
          p_paid_by: me?.id,
          p_child_ids: members.filter((member) => member.role === "child").map((member) => member.id),
          p_decision_proposal_id: params.get("decision"),
        })
          .then(() => setMessage(null))
          .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
      }}
    >
      <PageTitle>{t("money.add")}</PageTitle>
      <Field label={t("calendar.title")}>
        <input className={controlClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </Field>
      <Field label={t("money.amount")}>
        <input className={controlClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <Field label={t("money.category")}>
        <select className={controlClass} value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {t(`money.${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit">{t("shell.save")}</Button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  )
}

export function ExpenseDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const { family } = useFamily()
  const queryClient = useQueryClient()
  const expense = useQuery({
    queryKey: ["expense", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("id", id ?? "").single()
      if (error) throw error
      return data as Expense
    },
  })
  const history = useQuery({
    queryKey: ["expense-history", expense.data?.supersedes_id],
    enabled: Boolean(expense.data?.supersedes_id),
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("id", expense.data?.supersedes_id ?? "").single()
      if (error) throw error
      return data as Expense
    },
  })
  const row = expense.data
  if (!row) return <p>{t("shell.loading")}</p>
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <PageTitle>{row.title}</PageTitle>
      <p>{formatMoney(row.amount_minor, row.currency.trim(), i18n.language)}</p>
      <p>{t(`money.${row.category}`)}</p>
      {history.data ? (
        <p>
          {t("money.history")}: {formatMoney(history.data.amount_minor, history.data.currency.trim(), i18n.language)}
        </p>
      ) : null}
      <Field label={t("money.receipt")}>
        <input
          className={controlClass}
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file || !family) return
            void uploadImage(file, { familyId: family.id, ownerType: "expense", ownerId: row.id }).then(() =>
              queryClient.invalidateQueries({ queryKey: ["expense", id] }),
            )
          }}
        />
      </Field>
    </div>
  )
}
