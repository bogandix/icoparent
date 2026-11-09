import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n"
import { NotFoundPage } from "./RouteFallback"

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "*", element: <NotFoundPage /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
}

describe("NotFoundPage", () => {
  it("offers a way home in English", async () => {
    await i18n.changeLanguage("en")
    renderAt("/calendar")

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/")
  })

  it("offers a way home in Romanian", async () => {
    await i18n.changeLanguage("ro")
    renderAt("/calendar")

    expect(screen.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Înapoi acasă" })).toHaveAttribute("href", "/")
  })
})
