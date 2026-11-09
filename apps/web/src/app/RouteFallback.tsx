import { useTranslation } from "react-i18next"
import { isRouteErrorResponse, Link, useRouteError } from "react-router"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <Fallback
      title={t("notFound.title")}
      body={t("notFound.body")}
      homeLabel={t("notFound.home")}
    />
  )
}

export function RouteErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <Fallback
      title={t(notFound ? "notFound.title" : "error.title")}
      body={t(notFound ? "notFound.body" : "error.body")}
      homeLabel={t("notFound.home")}
    />
  )
}

function Fallback({ title, body, homeLabel }: { title: string; body: string; homeLabel: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-[max(1.5rem,env(safe-area-inset-left))] py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">{body}</p>
      <div>
        <Button asChild variant="outline">
          <Link to="/">{homeLabel}</Link>
        </Button>
      </div>
    </main>
  )
}
