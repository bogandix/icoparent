import { supabase } from "./supabase"

/** Fictional local accounts from seed.sql. This module is omitted from production builds. */
export const localActors = [
  { id: "parentA", email: "parent.a@example.com", password: "local-dev-password" },
  { id: "parentB", email: "parent.b@example.com", password: "local-dev-password" },
  { id: "child", email: "child@example.com", password: "local-dev-password" },
  { id: "outsider", email: "outsider@example.com", password: "local-dev-password" },
] as const

export type LocalActorId = (typeof localActors)[number]["id"]

export async function signInAsLocal(actorId: LocalActorId): Promise<void> {
  const actor = localActors.find((item) => item.id === actorId)
  if (!actor) {
    throw new Error("unknown_actor")
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  })
  if (error) {
    throw error
  }
}
