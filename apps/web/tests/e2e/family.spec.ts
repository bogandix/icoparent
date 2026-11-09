import { expect, test } from "@playwright/test"

async function signIn(page: import("@playwright/test").Page, name: string) {
  await page.goto("/login")
  await page.getByRole("button", { name }).click()
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible()
}

test("parent A and parent B see the same demo family", async ({ browser }) => {
  const parentA = await browser.newContext()
  const parentB = await browser.newContext()
  const pageA = await parentA.newPage()
  const pageB = await parentB.newPage()
  await signIn(pageA, "Parent A")
  await signIn(pageB, "Parent B")
  await expect(pageA.getByText("Football practice")).toBeVisible()
  await expect(pageB.getByText("Football practice")).toBeVisible()
  await parentA.close()
  await parentB.close()
})

test("a child cannot open parent money", async ({ page }) => {
  await signIn(page, "Child")
  await page.goto("/money")
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("link", { name: "Money" })).toHaveCount(0)
})
