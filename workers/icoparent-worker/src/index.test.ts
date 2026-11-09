import { describe, expect, it } from "vitest"
import worker, { handleRequest } from "./index"

describe("icoparent-worker", () => {
  it("names itself in the response body", async () => {
    const response = await handleRequest()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    await expect(response.text()).resolves.toBe("icoparent-worker")
  })

  it("serves that response from the fetch handler", async () => {
    if (!worker.fetch) {
      throw new Error("fetch handler is missing")
    }

    const response = await worker.fetch(
      new Request("https://worker.local/"),
      {},
      {} as ExecutionContext,
    )

    await expect(response.text()).resolves.toBe("icoparent-worker")
  })

  it("logs a push instead of sending it when PUSH_MODE is log", async () => {
    const response = await handleRequest(
      new Request("https://worker.local/push", {
        method: "POST",
        body: JSON.stringify({ notification_id: "demo" }),
      }),
      { PUSH_MODE: "log" },
    )
    expect(response.status).toBe(200)
    const log = await handleRequest(new Request("https://worker.local/push-log"))
    await expect(log.json()).resolves.toEqual([
      expect.objectContaining({ body: { notification_id: "demo" } }),
    ])
  })
})
