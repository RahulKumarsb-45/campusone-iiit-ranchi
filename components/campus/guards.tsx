"use client"

import type React from "react"
import Link from "next/link"
import { Lock, ShieldAlert, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import type { UserType } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"

function Centered({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <Icon className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-5 flex gap-2">{children}</div>}
    </div>
  )
}

/** UX gate only – the database (RLS) is what actually protects the data. */
export function RequireAuth({ children, roles, message }: { children: React.ReactNode; roles?: UserType["role"][]; message?: string }) {
  const { user, profileError, loading, signOut, refreshUser } = useAuth()

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!user && profileError) {
    return (
      <Centered icon={ShieldAlert} title="Couldn't load your profile" text={profileError}>
        <Button onClick={() => void refreshUser()}>Try again</Button>
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </Centered>
    )
  }
  if (!user) {
    return (
      <Centered icon={Lock} title="Sign in to continue" text={message ?? "You need a CampusOne account to view this page."}>
        <Button asChild><Link href="/auth/login">Sign in</Link></Button>
        <Button asChild variant="outline"><Link href="/auth/register">Create account</Link></Button>
      </Centered>
    )
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <Centered icon={ShieldAlert} title="Access restricted" text="Your account doesn't have permission to view this page.">
        <Button asChild variant="outline"><Link href="/dashboard">Back to dashboard</Link></Button>
      </Centered>
    )
  }
  return <>{children}</>
}
