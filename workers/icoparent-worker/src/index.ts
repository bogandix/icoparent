type Env = {
  PUSH_MODE?: string
  PUSH_SHARED_SECRET?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

const pushLog: { at: string; body: unknown }[] = []

function authorized(request: Request, env: Env): boolean {
  if (env.PUSH_MODE === "log" && !env.PUSH_SHARED_SECRET) return true
  const header = request.headers.get("authorization") ?? ""
  return Boolean(env.PUSH_SHARED_SECRET) && header === `Bearer ${env.PUSH_SHARED_SECRET}`
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function handleRequest(request = new Request("https://worker.local/"), env: Env = {}): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === "/push-log" && request.method === "GET") {
    return Response.json(pushLog)
  }

  if ((url.pathname === "/push" || url.pathname === "/jobs") && request.method === "POST") {
    if (!authorized(request, env)) return new Response("unauthorized", { status: 401 })
  }

  if (url.pathname === "/push" && request.method === "POST") {
    const body = await readJson(request)
    pushLog.push({ at: new Date().toISOString(), body })
    return Response.json({ delivered: "logged" })
  }

  if (url.pathname === "/jobs" && request.method === "POST") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ skipped: true })
    }
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/run_scheduled_jobs`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
    })
    const text = await response.text()
    return new Response(text, { status: response.status, headers: { "content-type": "application/json" } })
  }

  return new Response("icoparent-worker", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}

const worker: ExportedHandler<Env> = {
  fetch(request, env) {
    return handleRequest(request, env)
  },
  scheduled(_event, env) {
    return handleRequest(new Request("https://worker.local/jobs", { method: "POST" }), env).then(() => undefined)
  },
}

export default worker
