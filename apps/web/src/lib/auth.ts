import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import type { LocalActorId } from "./local-auth"
import { oauthRedirectUrl } from "./platform"
import { supabase } from "./supabase"

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, ready }
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: oauthRedirectUrl() },
  })
  if (error) throw error
}

export async function signInWithLocalActor(actorId: LocalActorId): Promise<void> {
  if (import.meta.env.VITE_AUTH_MODE !== "local") {
    throw new Error("local_auth_disabled")
  }
  const { signInAsLocal } = await import("./local-auth")
  await signInAsLocal(actorId)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const localAuthEnabled = import.meta.env.VITE_AUTH_MODE === "local"
