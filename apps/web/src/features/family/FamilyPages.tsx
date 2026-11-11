import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router"
import { controlClass, Field, PageTitle } from "@/components/Field"
import { Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"
import { errorCode } from "@/lib/errors"
import { useFamily } from "@/lib/family"
import { rpc } from "@/lib/rpc"
import { setTheme, storedTheme, type Theme } from "@/lib/theme"

export function OnboardingPage() {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Bucharest",
  )
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
        <input
          className={controlClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>
      <Field label={t("onboarding.timezone")}>
        <input
          className={controlClass}
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
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
  const queryClient = useQueryClient()
  const [childName, setChildName] = useState("")
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const usage = useState<number | null>(null)
  const isParent = me?.role === "parent"

  // Success text, or null to clear. Errors go through showError.
  const setMessage = (text: string | null) => setNotice(text ? { tone: "success", text } : null)
  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: ["members", family?.id] })
  const showError = (error: unknown) =>
    setNotice({ tone: "error", text: t(`errors.${errorCode(error)}`) })

  const addChild = () => {
    if (!family) return
    const name = childName.trim()
    const duplicate = members.some(
      (member) =>
        member.role === "child" && member.display_name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      setNotice({ tone: "error", text: t("errors.child_duplicate") })
      return
    }
    setBusy(true)
    setMessage(null)
    void rpc("add_child", {
      p_family_id: family.id,
      p_display_name: name,
      p_birthdate: null,
      p_color: "sky",
    })
      .then(async () => {
        setChildName("")
        await refreshMembers()
      })
      .catch(showError)
      .finally(() => setBusy(false))
  }

  const removeChild = (memberId: string) => {
    if (!family) return
    setBusy(true)
    setMessage(null)
    void rpc("remove_child", { p_family_id: family.id, p_member_id: memberId })
      .then(async () => {
        setConfirmRemoveId(null)
        await refreshMembers()
        setMessage(t("family.childRemoved"))
      })
      .catch(showError)
      .finally(() => setBusy(false))
  }

  const sectionClass = "flex flex-col gap-3 rounded-lg border border-border p-4"

  const shareInvite = async (role: "parent" | "child") => {
    if (!family) return
    setMessage(null)
    try {
      const token = await rpc<string>("create_invite", {
        p_family_id: family.id,
        p_email: null,
        p_role: role,
      })
      const link = `${window.location.origin}/invite/${token}`
      setInvite(link)
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "iCoParent", url: link }).catch(() => undefined)
      }
    } catch (error) {
      showError(error)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageTitle>{t("shell.more")}</PageTitle>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <section className={sectionClass}>
        <h2 className="font-medium">{t("family.members")}</h2>
        {members.map((member) => (
          <div key={member.id} className="flex min-h-11 items-center justify-between gap-3">
            <p>
              <i
                className={`mr-2 inline-block h-3 w-3 rounded-full parent-${member.color}`}
                aria-hidden
              />
              {member.display_name}
              {member.user_id == null ? ` · ${t("family.noLogin")}` : ""}
            </p>
            {isParent && member.role === "child" ? (
              confirmRemoveId === member.id ? (
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmRemoveId(null)}
                  >
                    {t("family.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => removeChild(member.id)}
                  >
                    {t("family.confirmRemoveChild", { name: member.display_name })}
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  aria-label={t("family.removeChildNamed", { name: member.display_name })}
                  onClick={() => setConfirmRemoveId(member.id)}
                >
                  {t("family.removeChild")}
                </Button>
              )
            ) : null}
          </div>
        ))}
        {isParent && family ? (
          <form
            className="flex flex-col gap-2 border-t border-border pt-3"
            onSubmit={(event) => {
              event.preventDefault()
              addChild()
            }}
          >
            <Field label={t("family.addChild")}>
              <input
                className={controlClass}
                value={childName}
                placeholder={t("family.childName")}
                onChange={(event) => setChildName(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={busy || childName.trim() === ""}>
              {t("family.addChild")}
            </Button>
          </form>
        ) : null}
      </section>
      {isParent && family ? (
        <section className={sectionClass}>
          <h2 className="font-medium">{t("family.invites")}</h2>
          <div className="grid grid-cols-1 gap-2">
            <Button type="button" variant="outline" onClick={() => void shareInvite("parent")}>
              {t("family.inviteParent")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void shareInvite("child")}>
              {t("family.inviteChild")}
            </Button>
          </div>
          {invite ? (
            <div className="flex flex-col gap-2">
              <input
                className={`${controlClass} text-sm`}
                readOnly
                value={invite}
                onFocus={(event) => event.target.select()}
              />
              <Button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invite)
                    .then(() => setMessage(t("family.copied")))
                }
              >
                {t("family.copy")}
              </Button>
              <p className="text-sm text-muted-foreground">{t("family.inviteHelp")}</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {isParent && family ? (
        <section className={sectionClass}>
          <h2 className="font-medium">{t("family.settings")}</h2>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void rpc("update_family", {
                p_family_id: family.id,
                p_name: family.name,
                p_timezone: family.timezone,
                p_currency: family.default_currency,
                p_children_can_post: (
                  event.currentTarget.elements.namedItem("childrenCanPost") as HTMLInputElement
                ).checked,
              })
                .then(async () => {
                  await queryClient.invalidateQueries({ queryKey: ["family", family.id] })
                  setMessage(t("family.settingsSaved"))
                })
                .catch(showError)
            }}
          >
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input
                name="childrenCanPost"
                type="checkbox"
                className="h-5 w-5"
                defaultChecked={family.children_can_post}
              />
              {t("family.childrenCanPost")}
            </label>
            <Button type="submit" variant="outline">
              {t("shell.save")}
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void rpc("storage_usage", { p_family_id: family.id }).then((bytes) =>
                usage[1](Number(bytes)),
              )
            }
          >
            {t("storage.used")}
          </Button>
          {usage[0] != null ? <p>{Math.round(usage[0] / (1024 * 1024))} MB / 1024 MB</p> : null}
          {usage[0] != null && usage[0] > 0.7 * 1024 * 1024 * 1024 ? (
            <p>{t("storage.warning")}</p>
          ) : null}
        </section>
      ) : null}
      <Preferences />
      <Button type="button" variant="outline" onClick={() => void signOut()}>
        {t("auth.signOut")}
      </Button>
    </div>
  )
}

function Preferences() {
  const { t, i18n } = useTranslation()
  const { me } = useFamily()
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const language = i18n.language.startsWith("ro") ? "ro" : "en"
  const segment = (active: boolean) =>
    `min-h-11 flex-1 rounded-md border px-3 text-base ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">{t("shell.preferences")}</h2>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("shell.language")}</span>
        <div className="flex gap-2" role="group" aria-label={t("shell.language")}>
          {(["en", "ro"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={language === code}
              className={segment(language === code)}
              onClick={() => {
                void i18n.changeLanguage(code)
                if (me)
                  void rpc("update_my_profile", {
                    p_display_name: me.display_name,
                    p_locale: code,
                  }).catch(() => undefined)
              }}
            >
              {code === "en" ? "English" : "Română"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("shell.theme")}</span>
        <div className="flex gap-2" role="group" aria-label={t("shell.theme")}>
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              className={segment(theme === value)}
              onClick={() => {
                setTheme(value)
                setThemeState(value)
              }}
            >
              {value === "light" ? t("shell.themeLight") : t("shell.themeDark")}
            </button>
          ))}
        </div>
      </div>
    </section>
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
