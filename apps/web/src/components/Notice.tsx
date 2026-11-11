import type { ReactNode } from "react"

/** Inline confirmation or error shown right where the user acted. */
export function Notice({
  tone = "success",
  children,
}: {
  tone?: "success" | "error"
  children: ReactNode
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          : "rounded-md border border-border bg-accent px-3 py-2 text-sm"
      }
    >
      {children}
    </p>
  )
}

/** Small pill used for statuses and counts. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
      {children}
    </span>
  )
}
