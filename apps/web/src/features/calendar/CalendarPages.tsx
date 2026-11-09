import "temporal-polyfill/global"
import "@fullcalendar/react/skeleton.css"
import "@fullcalendar/react/themes/classic/theme.css"
import "@fullcalendar/react/themes/classic/palette.css"
import FullCalendar from "@fullcalendar/react"
import type { DateSelectInfo, DatesSetInfo, DayCellInfo, EventClickInfo, EventInput } from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import listPlugin from "@fullcalendar/react/list"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import classicTheme from "@fullcalendar/react/themes/classic"
import roLocale from "@fullcalendar/react/locales/ro"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { rpc } from "@/lib/rpc"
import { expandRecurrence } from "@/lib/recurrence"
import { supabase } from "@/lib/supabase"
import { slotFromElement, type CalendarSlot } from "./calendar-slot"

type EventDraft = {
  starts: string
  ends: string
  kind: "child_event" | "parent_blocker"
}

type QuickMenuState = CalendarSlot & {
  pointer: "mouse" | "touch"
  x: number
  y: number
}

const calendarPlugins = [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]
const calendarLocales = [roLocale]

const parentTint: Record<string, string> = {
  teal: "#5eead4",
  amber: "#fbbf24",
  rose: "#fb7185",
  sky: "#7dd3fc",
  violet: "#c4b5fd",
  lime: "#bef264",
}

const eventSchema = z.object({
  title: z.string().min(1),
  starts: z.string().min(1),
  ends: z.string().min(1),
  location: z.string().optional(),
  kind: z.enum(["child_event", "parent_blocker"]),
})

type EventForm = z.infer<typeof eventSchema>

type RangeEvent = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  kind: string
  status: string
  rrule: string | null
  created_by: string
}

type Range = {
  custody: { date: string; parent_member_id: string | null }[]
  events: RangeEvent[]
  handovers: { id: string; scheduled_at: string; status: string }[]
}

type SelectedItem = {
  eventId: string
  title: string
  when: string
  source: "event" | "handover"
  createdBy: string
}

function zonedDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

function markerDay(value: unknown, timeZone: string): string | null {
  if (value instanceof Date) return zonedDay(value.toISOString(), timeZone)
  if (typeof value === "number") return zonedDay(new Date(value).toISOString(), timeZone)
  if (value && typeof value === "object" && "year" in value && "month" in value && "day" in value) {
    const plain = value as { year: number; month: number; day: number }
    return `${plain.year}-${String(plain.month).padStart(2, "0")}-${String(plain.day).padStart(2, "0")}`
  }
  return null
}

function toDateTimeLocal(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00"
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`
}

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const { family, members, me } = useFamily()
  const [range, setRange] = useState(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 7)
    return { from, to }
  })
  const [childId, setChildId] = useState("")
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [menu, setMenu] = useState<QuickMenuState | null>(null)
  const calendarRoot = useRef<HTMLDivElement>(null)
  const formAnchor = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const timeZone = family?.timezone || "UTC"

  const data = useQuery({
    queryKey: ["calendar", family?.id, range.from.toISOString(), range.to.toISOString()],
    enabled: Boolean(family?.id),
    queryFn: () =>
      rpc<Range>("calendar_range", {
        p_family: family?.id,
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
      }),
  })

  const links = useQuery({
    queryKey: ["event-children", family?.id],
    enabled: Boolean(family?.id && childId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("event_children")
        .select("event_id, child_member_id")
        .eq("family_id", family?.id ?? "")
      if (error) throw error
      return (rows ?? []) as { event_id: string; child_member_id: string }[]
    },
  })

  const names = new Map(members.map((member) => [member.id, member]))
  const allowed = new Set(
    (links.data ?? []).filter((row) => row.child_member_id === childId).map((row) => row.event_id),
  )
  const events = (data.data?.events ?? [])
    .filter((event) => (childId ? allowed.has(event.id) : true))
    .flatMap((event) =>
      expandRecurrence(new Date(event.starts_at), new Date(event.ends_at), event.rrule, range.to).map((start) => ({
        ...event,
        starts_at: start.toISOString(),
      })),
    )
  const custodyByDay = new Map(
    (data.data?.custody ?? []).map((day) => [day.date, day.parent_member_id] as const),
  )

  const calendarEvents: EventInput[] = []
  for (const day of data.data?.custody ?? []) {
    if (!day.parent_member_id) continue
    const parent = names.get(day.parent_member_id)
    if (!parent) continue
    const next = new Date(`${day.date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    calendarEvents.push({
      start: day.date,
      end: next.toISOString().slice(0, 10),
      display: "background",
      color: parentTint[parent.color] ?? "#99f6e4",
    })
  }
  for (const event of events) {
    const classes = [
      event.kind === "parent_blocker" ? "blocker-hatch" : "",
      event.status === "pending" ? "event-pending" : "",
    ].filter(Boolean)
    calendarEvents.push({
      id: `${event.id}-${event.starts_at}`,
      title: event.title,
      start: event.starts_at,
      end: event.ends_at,
      className: classes.join(" "),
      extendedProps: { source: "event", eventId: event.id, createdBy: event.created_by },
    })
  }
  for (const handover of data.data?.handovers ?? []) {
    const start = new Date(handover.scheduled_at)
    calendarEvents.push({
      id: `handover-${handover.id}`,
      title: t("calendar.handover"),
      start,
      end: new Date(start.getTime() + 30 * 60 * 1000),
      color: "#0f766e",
      extendedProps: { source: "handover" },
    })
  }

  useEffect(() => {
    const root = calendarRoot.current
    if (!root || me?.role !== "parent") return
    let timer = 0
    let startX = 0
    let startY = 0
    let pointerId = -1

    const open = (target: EventTarget | null, x: number, y: number, pointer: "mouse" | "touch") => {
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
      if (element?.closest(".icoparent-calendar-toolbar, input, select, textarea")) return
      const slot = slotFromElement(element)
      if (!slot) return
      setMenu({ ...slot, pointer, x, y })
    }

    const onContextMenu = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null
      if (!slotFromElement(element) || element?.closest(".icoparent-calendar-toolbar")) return
      event.preventDefault()
      open(event.target, event.clientX, event.clientY, "mouse")
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.button !== 0) return
      startX = event.clientX
      startY = event.clientY
      pointerId = event.pointerId
      window.clearTimeout(timer)
      timer = window.setTimeout(() => open(event.target, startX, startY, "touch"), 480)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      if (Math.abs(event.clientX - startX) > 12 || Math.abs(event.clientY - startY) > 12) {
        window.clearTimeout(timer)
      }
    }

    const endPress = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      window.clearTimeout(timer)
      pointerId = -1
    }

    root.addEventListener("contextmenu", onContextMenu)
    root.addEventListener("pointerdown", onPointerDown)
    root.addEventListener("pointermove", onPointerMove)
    root.addEventListener("pointerup", endPress)
    root.addEventListener("pointercancel", endPress)
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener("contextmenu", onContextMenu)
      root.removeEventListener("pointerdown", onPointerDown)
      root.removeEventListener("pointermove", onPointerMove)
      root.removeEventListener("pointerup", endPress)
      root.removeEventListener("pointercancel", endPress)
    }
  }, [me?.role])

  function onDates(info: DatesSetInfo) {
    setRange((current) => {
      if (current.from.getTime() === info.start.getTime() && current.to.getTime() === info.end.getTime()) return current
      return { from: info.start, to: info.end }
    })
  }

  function onEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault()
    const source = info.event.extendedProps.source === "handover" ? "handover" : "event"
    setSelected({
      eventId: String(info.event.extendedProps.eventId ?? info.event.id),
      title: info.event.title,
      when: info.event.start ? info.event.start.toLocaleString(i18n.language) : "",
      source,
      createdBy: String(info.event.extendedProps.createdBy ?? ""),
    })
  }

  function onSelect(info: DateSelectInfo) {
    const end = new Date(info.end)
    if (info.allDay) end.setMinutes(end.getMinutes() - 1)
    setDraft({
      starts: toDateTimeLocal(info.start, timeZone),
      ends: toDateTimeLocal(end, timeZone),
      kind: "child_event",
    })
  }

  function applySlot(kind: EventDraft["kind"]) {
    if (!menu) return
    setDraft({ starts: menu.starts, ends: menu.ends, kind })
    setMenu(null)
    requestAnimationFrame(() => formAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageTitle>{t("shell.calendar")}</PageTitle>
      <label className="text-sm">
        {t("calendar.filterChild")}
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
      </label>
      <div ref={calendarRoot} className="icoparent-calendar">
      <FullCalendar
        plugins={calendarPlugins}
        initialView="listWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "listWeek,timeGridDay,timeGridWeek,dayGridMonth",
        }}
        headerToolbarClass="icoparent-calendar-toolbar"
        todayText={t("calendar.today")}
        monthText={t("calendar.month")}
        weekTextLong={t("calendar.week")}
        dayText={t("calendar.day")}
        listText={t("calendar.agenda")}
        locales={calendarLocales}
        locale={i18n.language.startsWith("ro") ? "ro" : "en"}
        timeZone={timeZone}
        height="auto"
        expandRows={false}
        dayMaxEventRows={3}
        dayRowClass="icoparent-day-row"
        views={{
          timeGridDay: { contentHeight: 640 },
          timeGridWeek: { contentHeight: 640 },
        }}
        nowIndicator
        navLinks
        selectable
        selectMirror
        longPressDelay={3000}
        selectLongPressDelay={3000}
        eventDidMount={(info) => {
          if (!info.event.start) return
          info.el.dataset.quickStart = toDateTimeLocal(info.event.start, timeZone)
          if (info.event.end) info.el.dataset.quickEnd = toDateTimeLocal(info.event.end, timeZone)
          info.el.dataset.quickTitle = info.event.title
        }}
        events={calendarEvents}
        datesSet={onDates}
        eventClick={onEventClick}
        select={onSelect}
        noEventsContent={t("calendar.empty")}
        dayCellTopContent={(info: DayCellInfo) => {
          const key = markerDay(info.date, timeZone)
          const parentId = key ? custodyByDay.get(key) : undefined
          const parent = parentId ? names.get(parentId) : undefined
          return (
            <span className="flex w-full items-center justify-between gap-0.5 leading-none">
              <span className="font-medium">{info.dayNumberText}</span>
              {parent ? (
                <i
                  className={`inline-block h-2 w-2 shrink-0 rounded-full parent-${parent.color}`}
                  title={parent.display_name}
                />
              ) : null}
            </span>
          )
        }}
      />
      </div>
      {me?.role === "parent" ? <p className="text-sm text-muted-foreground">{t("calendar.quickHint")}</p> : null}
      {me?.role === "parent" ? <p className="text-sm text-muted-foreground">{t("calendar.tapEvent")}</p> : null}
      {menu && me?.role === "parent" ? (
        <QuickMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onEvent={() => applySlot("child_event")}
          onUnavailable={() => applySlot("parent_blocker")}
          onCover={() => {
            const slot = menu
            setMenu(null)
            void navigate(
              `/agreements/new?kind=blocker_request&starts=${encodeURIComponent(slot.starts)}&ends=${encodeURIComponent(slot.ends)}`,
            )
          }}
        />
      ) : null}
      {selected ? (
        <article className="rounded-md border border-border p-3">
          <p className="font-medium">{selected.title}</p>
          <p className="text-sm text-muted-foreground">{selected.when}</p>
          {selected.source === "event" && me?.role === "parent" ? (
            <Acknowledge
              subjectType="event"
              subjectId={selected.eventId}
              authorId={selected.createdBy}
              onDone={() => {
                setSelected(null)
                void queryClient.invalidateQueries({ queryKey: ["calendar"] })
              }}
            />
          ) : null}
        </article>
      ) : null}
      {me?.role === "parent" ? (
        <div ref={formAnchor}>
          <EventForm slot={draft} />
        </div>
      ) : null}
    </div>
  )
}

export function Acknowledge({
  subjectType,
  subjectId,
  authorId,
  onDone,
}: {
  subjectType: "event" | "expense" | "post"
  subjectId: string
  authorId: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const { me } = useFamily()
  if (me?.role !== "parent") return null
  const author = me.id === authorId
  return (
    <div className="mt-2 flex flex-col gap-2">
      {author ? null : (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void rpc("acknowledge", { p_subject_type: subjectType, p_subject_id: subjectId })
              .then(onDone)
              .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
          }
        >
          {t("calendar.acknowledge")}
        </Button>
      )}
      {author ? (
        <>
          <input
            className={controlClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("calendar.reason")}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void rpc("void_item", { p_subject_type: subjectType, p_subject_id: subjectId, p_reason: reason })
                .then(onDone)
                .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
            }
          >
            {t("calendar.void")}
          </Button>
        </>
      ) : null}
      {message ? <p role="alert">{message}</p> : null}
    </div>
  )
}

function QuickMenu({
  menu,
  onClose,
  onEvent,
  onUnavailable,
  onCover,
}: {
  menu: QuickMenuState
  onClose: () => void
  onEvent: () => void
  onUnavailable: () => void
  onCover: () => void
}) {
  const { t } = useTranslation()
  const sheet = menu.pointer === "touch"
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 288))
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 240))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("calendar.quickTitle")}
        className={
          sheet
            ? "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 rounded-t-2xl border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "fixed z-50 flex w-72 flex-col gap-2 rounded-xl border border-border bg-background p-3 shadow-lg"
        }
        style={sheet ? undefined : { left, top }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-medium">{t("calendar.quickTitle")}</p>
        <p className="text-sm text-muted-foreground">{menu.label.replace("T", " ")}</p>
        <Button type="button" onClick={onEvent}>
          {t("calendar.addEvent")}
        </Button>
        <Button type="button" variant="outline" onClick={onUnavailable}>
          {t("calendar.addBlocker")}
        </Button>
        <Button type="button" variant="outline" onClick={onCover}>
          {t("calendar.quickCover")}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("shell.cancel")}
        </Button>
      </div>
    </div>
  )
}

function EventForm({ slot }: { slot: EventDraft | null }) {
  const { t } = useTranslation()
  const { family } = useFamily()
  const queryClient = useQueryClient()
  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", starts: "", ends: "", location: "", kind: "child_event" },
  })
  const unavailable = form.watch("kind") === "parent_blocker"
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!slot) return
    form.setValue("starts", slot.starts)
    form.setValue("ends", slot.ends)
    form.setValue("kind", slot.kind)
  }, [form, slot])

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          try {
            await rpc("create_event", {
              p_family_id: family?.id,
              p_kind: values.kind,
              p_title: values.title,
              p_notes: null,
              p_starts_at: new Date(values.starts).toISOString(),
              p_ends_at: new Date(values.ends).toISOString(),
              p_all_day: false,
              p_rrule: null,
              p_location: values.location ?? null,
              p_visibility: values.kind === "parent_blocker" ? "parents" : "family",
              p_child_ids: [],
            })
            form.reset()
            await queryClient.invalidateQueries({ queryKey: ["calendar"] })
          } catch (error) {
            setMessage(t(`errors.${errorCode(error)}`))
          }
        })(event)
      }
    >
      <Field label={t("calendar.title")}>
        <input className={controlClass} {...form.register("title")} />
      </Field>
      <Field label={t("calendar.starts")}>
        <input className={controlClass} type="datetime-local" {...form.register("starts")} />
      </Field>
      <Field label={t("calendar.ends")}>
        <input className={controlClass} type="datetime-local" {...form.register("ends")} />
      </Field>
      <Field label={t("calendar.location")}>
        <input className={controlClass} {...form.register("location")} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={unavailable}
          onChange={(event) => form.setValue("kind", event.target.checked ? "parent_blocker" : "child_event")}
        />
        {t("calendar.addBlocker")}
      </label>
      {unavailable ? <p className="text-sm text-muted-foreground">{t("calendar.blockerHelp")}</p> : null}
      <Button type="submit">{unavailable ? t("calendar.addBlocker") : t("calendar.addEvent")}</Button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  )
}

export function CustodyPage() {
  const { t } = useTranslation()
  const { family } = useFamily()
  const [preset, setPreset] = useState("week_on_week_off")
  const [message, setMessage] = useState<string | null>(null)
  const [starts, setStarts] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState("18:00")
  const [place, setPlace] = useState("")

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>{t("calendar.custody")}</PageTitle>
      {(["week_on_week_off", "2_2_3", "2_2_5_5", "alternate_weekends"] as const).map((item) => (
        <Button key={item} type="button" variant={preset === item ? "default" : "outline"} onClick={() => setPreset(item)}>
          {t(`custody.${item}`)}
        </Button>
      ))}
      <Field label={t("custody.starts")}>
        <input className={controlClass} type="date" value={starts} onChange={(event) => setStarts(event.target.value)} />
      </Field>
      <Field label={t("custody.handoverTime")}>
        <input className={controlClass} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </Field>
      <Field label={t("custody.handoverPlace")}>
        <input className={controlClass} value={place} onChange={(event) => setPlace(event.target.value)} />
      </Field>
      <Button
        type="button"
        onClick={() =>
          void rpc<{ status: string }>("save_custody_pattern", {
            p_family_id: family?.id,
            p_name: preset,
            p_starts_on: starts,
            p_preset: preset,
            p_segments: null,
            p_handover_time: time,
            p_handover_location: place,
          })
            .then((result) => setMessage(result.status === "proposed" ? t("custody.proposed") : null))
            .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
        }
      >
        {t("custody.save")}
      </Button>
      {message ? <p>{message}</p> : null}
    </div>
  )
}
