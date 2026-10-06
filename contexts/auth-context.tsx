"use client"

import type React from "react"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { User as AuthUser } from "@supabase/supabase-js"
import { supabase, type UserType } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: UserType | null
  /** Set when a session exists but the database profile could not be loaded. */
  profileError: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (
    email: string,
    password: string,
    userData: Partial<UserType>,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>
  signOut: () => Promise<void>
  googleSignIn: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Self-service roles. admin / club_admin can only be granted by an administrator (enforced in the DB too).
const SELF_ROLES = ["student", "faculty", "guest"] as const
const safeRole = (r: unknown): UserType["role"] => ((SELF_ROLES as readonly string[]).includes(r as string) ? (r as UserType["role"]) : "student")

const PROFILE_ERROR = "We couldn't load your CampusOne profile. Please try again, or sign out and sign back in."

type ProfileResult = { profile: UserType; error: null } | { profile: null; error: string }

/** Reads the caller's row from public.users. `failed` separates a database error from "no row". */
async function fetchProfile(id: string): Promise<{ row: UserType | null; failed: boolean }> {
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("Profile load failed", error.code, error.message)
    return { row: null, failed: true }
  }
  return { row: (data as UserType | null) ?? null, failed: false }
}

/**
 * A profile only counts as loaded when a real public.users row was read back from the database.
 * Normally the on_auth_user_created trigger has already created it; if it is missing we try to create
 * it once (RLS + guard triggers decide what is allowed) and read it back. Nothing is ever synthesised.
 */
async function loadProfile(authUser: AuthUser): Promise<ProfileResult> {
  const first = await fetchProfile(authUser.id)
  if (first.failed) return { profile: null, error: PROFILE_ERROR }
  if (first.row) return { profile: first.row, error: null }

  const meta = authUser.user_metadata ?? {}
  const { error: insertError } = await supabase.from("users").insert([
    {
      id: authUser.id,
      email: authUser.email ?? "",
      name: meta.name || meta.full_name || (authUser.email ? authUser.email.split("@")[0] : "Student"),
      role: safeRole(meta.role),
      department: meta.department,
      year: meta.year,
      roll_number: meta.roll_number,
      position: meta.position,
      avatar_url: meta.avatar_url || meta.picture,
    },
  ])
  if (insertError && insertError.code !== "23505") {
    console.error("Could not create profile row", insertError.code, insertError.message)
    return { profile: null, error: PROFILE_ERROR }
  }
  const second = await fetchProfile(authUser.id)
  return second.row ? { profile: second.row, error: null } : { profile: null, error: PROFILE_ERROR }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setUser(null)
      setProfileError(null)
      return
    }
    const result = await loadProfile(session.user)
    setUser(result.profile)
    setProfileError(result.error)
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer Supabase calls out of the callback to avoid auth-lock deadlocks.
      if (event === "SIGNED_IN" && session) {
        setTimeout(async () => {
          const result = await loadProfile(session.user)
          setUser(result.profile)
          setProfileError(result.error)
        }, 0)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfileError(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [refreshUser])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/dashboard")
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." }
    }
  }

  const signUp = async (email: string, password: string, userData: Partial<UserType>) => {
    try {
      const role = safeRole(userData.role)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // FIX: confirmation link ab isi app ke /auth/callback par aayega (localhost:3001), default :3000 par nahi.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name: userData.name,
            role,
            department: userData.department,
            year: userData.year,
            roll_number: userData.roll_number,
            position: userData.position,
          },
        },
      })
      if (error) throw error

      // With email confirmation on there is no session yet; the profile row is created on first sign-in.
      if (!data.session) return { needsConfirmation: true }

      // The profile row is created by the on_auth_user_created database trigger (role is validated there).
      if (data.user) await refreshUser()

      router.push("/dashboard")
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfileError(null)
    router.push("/")
  }

  const googleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, profileError, loading, signIn, signUp, signOut, googleSignIn, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}