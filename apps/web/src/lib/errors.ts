export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message)
    const match = /[a-z][a-z0-9_]*/.exec(message)
    return match?.[0] ?? "unknown"
  }
  return "unknown"
}
