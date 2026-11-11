import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { formatDay } from "@/lib/format"
import { uploadAudio, uploadImage } from "@/lib/storage"
import { supabase } from "@/lib/supabase"

type Post = {
  id: string
  body: string | null
  audience: "family" | "parents"
  happened_on: string
  author_member_id: string
}

export function FeedPage() {
  const { t, i18n } = useTranslation()
  const { family, me, members } = useFamily()
  const queryClient = useQueryClient()
  const [reacted, setReacted] = useState<Set<string>>(() => new Set())
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<"family" | "parents">("family")
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [hasPhoto, setHasPhoto] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const started = useRef(0)
  const posts = useQuery({
    queryKey: ["posts", family?.id],
    enabled: Boolean(family?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("family_id", family?.id ?? "")
        .eq("status", "active")
        .order("happened_on", { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as Post[]
    },
  })
  const names = new Map(members.map((member) => [member.id, member.display_name]))
  const today = new Date()
  const onThisDay = (posts.data ?? []).find((post) => {
    const happened = new Date(post.happened_on)
    return happened.getMonth() === today.getMonth() && happened.getDate() === today.getDate()
  })

  async function publish(extra?: { file?: File; audio?: { blob: Blob; durationMs: number } }) {
    if (!family || !me) return
    setBusy(true)
    setNotice(null)
    try {
      await insertPost(extra)
      setNotice({ tone: "success", text: t("feed.posted") })
      formRef.current?.reset()
      setHasPhoto(false)
    } catch (error) {
      setNotice({ tone: "error", text: t(`errors.${errorCode(error)}`) })
    } finally {
      setBusy(false)
    }
  }

  async function insertPost(extra?: { file?: File; audio?: { blob: Blob; durationMs: number } }) {
    if (!family || !me) return
    const { data, error } = await supabase
      .from("posts")
      .insert({
        family_id: family.id,
        author_member_id: me.id,
        body,
        audience: me.role === "child" ? "family" : audience,
        happened_on: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single()
    if (error) throw error
    const post = data as { id: string }
    if (extra?.file)
      await uploadImage(extra.file, { familyId: family.id, ownerType: "post", ownerId: post.id })
    if (extra?.audio)
      await uploadAudio(extra.audio.blob, extra.audio.durationMs, {
        familyId: family.id,
        ownerType: "post",
        ownerId: post.id,
      })
    setBody("")
    await queryClient.invalidateQueries({ queryKey: ["posts", family.id] })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PageTitle>{t("shell.feed")}</PageTitle>
      {onThisDay ? (
        <p>
          {t("feed.onThisDay")}: {onThisDay.body}
        </p>
      ) : null}
      <form
        ref={formRef}
        className="flex flex-col gap-3 rounded-lg border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const file = (event.currentTarget.elements.namedItem("photo") as HTMLInputElement)
            .files?.[0]
          void publish(file ? { file } : undefined)
        }}
      >
        <Field label={t("feed.body")}>
          <textarea
            className={controlClass}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        {me?.role === "parent" ? (
          <Field label={t("shell.parentsOnly")}>
            <select
              className={controlClass}
              value={audience}
              onChange={(event) => setAudience(event.target.value as "family" | "parents")}
            >
              <option value="family">{t("feed.audienceFamily")}</option>
              <option value="parents">{t("feed.audienceParents")}</option>
            </select>
          </Field>
        ) : null}
        <Field label={t("feed.photo")}>
          <input
            className={controlClass}
            name="photo"
            type="file"
            accept="image/*"
            onChange={(event) => setHasPhoto(Boolean(event.target.files?.length))}
          />
        </Field>
        <Button type="submit" size="lg" disabled={busy || (body.trim() === "" && !hasPhoto)}>
          {t("feed.new")}
        </Button>
        <Button
          type="button"
          variant={recording ? "destructive" : "outline"}
          disabled={busy}
          className="touch-none select-none"
          onPointerUp={() => {
            recorder.current?.stop()
            setRecording(false)
          }}
          onPointerLeave={() => {
            if (recorder.current?.state === "recording") {
              recorder.current.stop()
              setRecording(false)
            }
          }}
          onPointerDown={() => {
            setRecording(true)
            void navigator.mediaDevices
              .getUserMedia({ audio: true })
              .then((stream) => {
                const media = new MediaRecorder(stream)
                const chunks: BlobPart[] = []
                media.ondataavailable = (event) => chunks.push(event.data)
                media.onstop = () => {
                  const durationMs = Date.now() - started.current
                  stream.getTracks().forEach((track) => track.stop())
                  void publish({
                    audio: { blob: new Blob(chunks, { type: media.mimeType }), durationMs },
                  })
                }
                recorder.current = media
                started.current = Date.now()
                media.start()
              })
              .catch(() => {
                setRecording(false)
                setNotice({ tone: "error", text: t("feed.micBlocked") })
              })
          }}
        >
          {recording ? t("feed.recording") : t("feed.record")}
        </Button>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      </form>
      {posts.isSuccess && (posts.data ?? []).length === 0 ? (
        <p className="text-muted-foreground">{t("shell.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-4">
        {(posts.data ?? []).map((post) => (
          <li key={post.id} className="rounded-lg border border-border p-3">
            <p className="text-sm text-muted-foreground">
              {names.get(post.author_member_id)} · {formatDay(post.happened_on, i18n.language)}
              {post.audience === "parents" ? ` · ${t("feed.audienceParents")}` : ""}
            </p>
            <p className="whitespace-pre-wrap">{post.body}</p>
            <div className="mt-2 flex gap-2">
              {(["heart", "smile", "hug"] as const).map((emoji) => {
                const key = `${post.id}:${emoji}`
                const on = reacted.has(key)
                return (
                  <button
                    key={emoji}
                    type="button"
                    aria-pressed={on}
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm ${on ? "border-primary bg-accent font-medium" : "border-border"}`}
                    onClick={() => {
                      if (!family || !me || on) return
                      setReacted((current) => new Set(current).add(key))
                      void supabase.from("reactions").insert({
                        family_id: family.id,
                        post_id: post.id,
                        member_id: me.id,
                        emoji,
                      })
                    }}
                  >
                    {t(`feed.${emoji}`)}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
