import { useTranslation } from "react-i18next"

export function HomePage() {
  const { t } = useTranslation()

  return (
    <header className="flex flex-col gap-2">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">{t("home.kicker")}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t("home.title")}</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">{t("home.subtitle")}</p>
    </header>
  )
}
