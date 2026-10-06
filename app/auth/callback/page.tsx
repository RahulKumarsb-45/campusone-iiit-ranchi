"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// Completes the Google OAuth redirect (the original project had no callback route).
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const finish = async () => {
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) await supabase.auth.exchangeCodeForSession(code)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!cancelled) router.replace(session ? "/dashboard" : "/auth/login")
    }
    finish()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">
      Signing you in to CampusOne…
    </div>
  )
}
