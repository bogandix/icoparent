export function assertProductionAuthMode(mode: string, authMode: string | undefined): void {
  if (mode === "production" && authMode === "local") {
    throw new Error("VITE_AUTH_MODE=local must not be used in a production build")
  }
}
