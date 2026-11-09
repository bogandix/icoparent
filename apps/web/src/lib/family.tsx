import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useSession } from "./auth"
import { supabase } from "./supabase"

export type Member = {
  id: string
  family_id: string
  user_id: string | null
  role: "parent" | "child"
  display_name: string
  color: string
  birthdate: string | null
  status: string
}

export type Family = {
  id: string
  name: string
  timezone: string
  default_currency: string
  children_can_post: boolean
}

type FamilyState = {
  family: Family | null
  members: Member[]
  me: Member | null
  loading: boolean
  setFamilyId: (id: string) => void
}

const FamilyContext = createContext<FamilyState | null>(null)
const storageKey = "icoparent.family"

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const [familyId, setFamilyIdState] = useState<string | null>(localStorage.getItem(storageKey))

  const memberships = useQuery({
    queryKey: ["memberships", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("user_id", session?.user.id ?? "")
        .eq("status", "active")
      if (error) throw error
      return (data ?? []) as Member[]
    },
  })

  useEffect(() => {
    const first = memberships.data?.[0]
    if (!familyId && first) {
      setFamilyIdState(first.family_id)
      localStorage.setItem(storageKey, first.family_id)
    }
  }, [familyId, memberships.data])

  const activeId = familyId ?? memberships.data?.[0]?.family_id ?? null

  const familyQuery = useQuery({
    queryKey: ["family", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("*").eq("id", activeId ?? "").single()
      if (error) throw error
      return data as Family
    },
  })

  const membersQuery = useQuery({
    queryKey: ["members", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("family_id", activeId ?? "")
        .eq("status", "active")
      if (error) throw error
      return (data ?? []) as Member[]
    },
  })

  const value = useMemo<FamilyState>(() => {
    const members = membersQuery.data ?? []
    return {
      family: familyQuery.data ?? null,
      members,
      me: members.find((member) => member.user_id === session?.user.id) ?? null,
      loading: memberships.isLoading || familyQuery.isLoading || membersQuery.isLoading,
      setFamilyId: (id: string) => {
        localStorage.setItem(storageKey, id)
        setFamilyIdState(id)
      },
    }
  }, [familyQuery.data, familyQuery.isLoading, membersQuery.data, membersQuery.isLoading, memberships.isLoading, session?.user.id])

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily(): FamilyState {
  const value = useContext(FamilyContext)
  if (!value) throw new Error("FamilyProvider is missing")
  return value
}

export function useHasFamily(): boolean {
  const { session } = useSession()
  const memberships = useQuery({
    queryKey: ["memberships", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", session?.user.id ?? "")
        .eq("status", "active")
      if (error) throw error
      return data ?? []
    },
  })
  return (memberships.data?.length ?? 0) > 0
}
