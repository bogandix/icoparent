const key = "icoparent.theme"

export type Theme = "light" | "dark"

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(key) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    localStorage.setItem(key, theme)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}

export function applyStoredTheme(): void {
  document.documentElement.classList.toggle("dark", storedTheme() === "dark")
}
