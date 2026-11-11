import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate } from "react-router"
import { Notice } from "@/components/Notice"
import { Button } from "@/components/ui/button"
import { HomePage } from "@/app/HomePage"
import { localAuthEnabled, signInWithGoogle, signInWithLocalActor, useSession } from "@/lib/auth"
import { i18n } from "@/lib/i18n"
import { supabaseConfigured } from "@/lib/supabase"
import type { LocalActorId } from "@/lib/local-auth"

const actors: LocalActorId[] = ["parentA", "parentB", "child", "outsider"]

export function LoginPage() {
  const { t } = useTranslation()
  const { session, ready } = useSession()
  const [error, setError] = useState<string | null>(null)

  if (ready && session) return <Navigate to="/" replace />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-[max(1.5rem,env(safe-area-inset-left))] py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <HomePage />
      <div className="flex gap-2" role="group" aria-label={t("auth.language")}>
        {(["en", "ro"] as const).map((locale) => (
          <Button
            key={locale}
            type="button"
            variant={i18n.language.startsWith(locale) ? "default" : "outline"}
            onClick={() => void i18n.changeLanguage(locale)}
          >
            {locale.toUpperCase()}
          </Button>
        ))}
      </div>
      {!supabaseConfigured ? (
        <p className="text-muted-foreground">{t("auth.missingConfig")}</p>
      ) : null}
      <Button
        type="button"
        size="lg"
        onClick={() => {
          setError(null)
          void signInWithGoogle().catch((reason: unknown) => {
            console.error(reason)
            setError(t("auth.failed"))
          })
        }}
      >
        {t("auth.google")}
      </Button>
      {localAuthEnabled ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t("auth.localTitle")}</h2>
          {actors.map((actor) => (
            <Button
              key={actor}
              type="button"
              variant="outline"
              onClick={() =>
                void signInWithLocalActor(actor).catch((reason: unknown) => {
                  console.error(reason)
                  setError(t("auth.failed"))
                })
              }
            >
              {t(`auth.${actor}`)}
            </Button>
          ))}
        </section>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </main>
  )
}
