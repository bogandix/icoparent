import type { ReactNode } from "react"

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export const controlClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"

export const linkRowClass =
  "flex min-h-11 items-center rounded-md text-base active:bg-accent"

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
}
