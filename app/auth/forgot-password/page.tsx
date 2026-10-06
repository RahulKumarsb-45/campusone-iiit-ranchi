"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset-password` })
    setLoading(false)
    // Same message either way so accounts can't be enumerated.
    if (error && error.status && error.status >= 500) return toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" })
    setSent(true)
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader><CardTitle className="text-2xl font-semibold">Reset your password</CardTitle><CardDescription>We&apos;ll email you a link to choose a new one.</CardDescription></CardHeader>
        <CardContent>
          {sent ? (
            <p role="status" className="text-sm">If an account exists for that email, a reset link is on its way.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm"><Link href="/auth/login" className="text-primary hover:underline">Back to sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  )
}
