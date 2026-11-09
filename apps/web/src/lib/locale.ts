const SUPPORTED_LOCALES = ["en", "ro"] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Browser language before sign-in. Romanian when any preferred language starts with `ro`, otherwise English. */
export function detectLocale(languages: readonly string[]): AppLocale {
  const romanian = languages.some((language) => language.toLowerCase().startsWith("ro"))
  return romanian ? "ro" : "en"
}
