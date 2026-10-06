"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/campus/page-header"
import { RequireAuth } from "@/components/campus/guards"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  return (
    <RequireAuth message="Sign in to manage your settings.">
      <div className="mx-auto w-full max-w-2xl space-y-6 p-4 py-6 lg:p-6">
        <PageHeader title="Settings" />
        <Card><CardHeader><CardTitle className="text-lg">Appearance</CardTitle><CardDescription>Choose how CampusOne looks on this device.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2" role="group" aria-label="Theme">
            {["light", "dark", "system"].map((t) => <Button key={t} variant={theme === t ? "default" : "outline"} size="sm" className="capitalize" aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</Button>)}
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Account</CardTitle><CardDescription>Update your name, branch, batch and other details.</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline"><Link href="/profile">Edit profile</Link></Button></CardContent></Card>
      </div>
    </RequireAuth>
  )
}
