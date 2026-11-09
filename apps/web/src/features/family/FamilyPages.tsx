import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { rpc } from "@/lib/rpc"

export function OnboardingPage() {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Bucharest")
  const [message, setMessage] = useState<string | null>(null)

  return (
    <form
      className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-[max(1.5rem,env(safe-area-inset-left))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault()
        void rpc("create_family", { p_name: name, p_timezone: timezone, p_currency: "RON" })
          .then(() => window.location.assign("/"))
          .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
      }}
    >
      <PageTitle>{t("onboarding.title")}</PageTitle>
      <Field label={t("onboarding.name")}>
        <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label={t("onboarding.timezone")}>
        <input className={controlClass} value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
      </Field>
      <Field label={t("onboarding.currency")}>
        <input className={controlClass} value="RON" readOnly />
      </Field>
      <Button type="submit">{t("onboarding.create")}</Button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  )
}

export function MorePage() {
  const { t } = useTranslation()
  const { family, members, me } = useFamily()
  const [childName, setChildName] = useState("")
  const [invite, setInvite] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const usage = useState<number | null>(null)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageTitle>{t("shell.more")}</PageTitle>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("family.members")}</h2>
        {members.map((member) => (
          <p key={member.id}>
            <i className={`mr-2 inline-block h-3 w-3 rounded-full parent-${member.color}`} aria-hidden />
            {member.display_name}
            {member.user_id == null ? ` · ${t("family.noLogin")}` : ""}
          </p>
        ))}
      </section>
      {me?.role === "parent" && family ? (
        <>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void rpc("update_family", {
                p_family_id: family.id,
                p_name: family.name,
                p_timezone: family.timezone,
                p_currency: family.default_currency,
                p_children_can_post: (event.currentTarget.elements.namedItem("childrenCanPost") as HTMLInputElement).checked,
              }).catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
            }}
          >
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input name="childrenCanPost" type="checkbox" defaultChecked={family.children_can_post} />
              {t("family.childrenCanPost")}
            </label>
            <Button type="submit">{t("shell.save")}</Button>
          </form>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void rpc("add_child", {
                p_family_id: family.id,
                p_display_name: childName,
                p_birthdate: null,
                p_color: "sky",
              })
                .then(() => setChildName(""))
                .catch((error: unknown) => setMessage(t(`errors.${errorCode(error)}`)))
            }}
          >
            <Field label={t("family.childName")}>
              <input className={controlClass} value={childName} onChange={(event) => setChildName(event.target.value)} required />
            </Field>
            <Button type="submit">{t("family.addChild")}</Button>
          </form>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void rpc<string>("create_invite", { p_family_id: family.id, p_email: null, p_role: "parent" }).then((token) =>
                setInvite(`${window.location.origin}/invite/${token}`),
              )
            }
          >
            {t("family.inviteParent")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void rpc<string>("create_invite", { p_family_id: family.id, p_email: null, p_role: "child" }).then((token) =>
                setInvite(`${window.location.origin}/invite/${token}`),
              )
            }
          >
            {t("family.inviteChild")}
          </Button>
          {invite ? (
            <Button
              type="button"
              onClick={() => void navigator.clipboard.writeText(invite).then(() => setMessage(t("family.copied")))}
            >
              {t("family.copy")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void rpc("storage_usage", { p_family_id: family.id }).then((bytes) => usage[1](Number(bytes)))}
          >
            {t("storage.used")}
          </Button>
          {usage[0] != null ? <p>{Math.round(usage[0] / (1024 * 1024))} MB</p> : null}
          {usage[0] != null && usage[0] > 0.7 * 1024 * 1024 * 1024 ? <p>{t("storage.warning")}</p> : null}
        </>
      ) : null}
      <Button type="button" variant="outline" onClick={() => void signOut()}>
        {t("auth.signOut")}
      </Button>
      {message ? <p>{message}</p> : null}
    </div>
  )
}

export function InvitePage() {
  const { token } = useParams()
  const { t } = useTranslation()
  const [message, setMessage] = useState<string | null>(null)
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-[max(1.5rem,env(safe-area-inset-left))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <PageTitle>{t("family.invite")}</PageTitle>
      <Button
        type="button"
        onClick={() =>
          void rpc("accept_invite", { p_token: token }).then(
            () => window.location.assign("/"),
            (error: unknown) => setMessage(t(`errors.${errorCode(error)}`)),
          )
        }
      >
        {t("family.invite")}
      </Button>
      {message ? <p role="alert">{message}</p> : null}
    </main>
  )
}
