import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "@/locales/en/common.json"
import ro from "@/locales/ro/common.json"
import { detectLocale, isAppLocale, type AppLocale } from "./locale"

export async function initI18n(languages: readonly string[] = navigator.languages): Promise<void> {
  if (i18n.isInitialized) {
    return
  }

  const lng = detectLocale(languages)

  await i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
      ro: { common: ro },
    },
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "ro"],
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  })

  applyDocumentLanguage(i18n.language)
  i18n.on("languageChanged", applyDocumentLanguage)
}

function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = toAppLocale(language)
}

export function toAppLocale(language: string): AppLocale {
  const base = language.toLowerCase().split("-")[0] ?? "en"
  return isAppLocale(base) ? base : "en"
}

export { i18n }
