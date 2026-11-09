import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n"
import { HomePage } from "./HomePage"

describe("HomePage", () => {
  it("shows the English placeholder", async () => {
    await i18n.changeLanguage("en")
    render(<HomePage />)

    expect(screen.getByRole("heading", { name: "iCoParent" })).toBeInTheDocument()
    expect(
      screen.getByText("A calm, private space for two parents and their children."),
    ).toBeInTheDocument()
  })

  it("shows the Romanian placeholder", async () => {
    await i18n.changeLanguage("ro")
    render(<HomePage />)

    expect(screen.getByText("Coparentalitate")).toBeInTheDocument()
    expect(
      screen.getByText("Un spațiu calm și privat pentru doi părinți și copiii lor."),
    ).toBeInTheDocument()
  })
})
