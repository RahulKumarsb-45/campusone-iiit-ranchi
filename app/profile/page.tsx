"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/campus/page-header"
import { RequireAuth } from "@/components/campus/guards"
import { useAuth } from "@/contexts/auth-context"
import { friendlyError, safeUrl } from "@/lib/data"
import { roleLabel } from "@/lib/roles"
import { supabase, type ClubType, type EventType, type UserType } from "@/lib/supabase"

type FieldKey = "name" | "phone" | "department" | "branch" | "batch" | "semester" | "year" | "roll_number" | "position" | "avatar_url" | "bio"
const FIELDS: { key: FieldKey; label: string; roles?: UserType["role"][]; wide?: boolean }[] = [
  { key: "name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "department", label: "Department" },
  { key: "branch", label: "Branch", roles: ["student", "club_admin"] },
  { key: "batch", label: "Batch", roles: ["student", "club_admin"] },
  { key: "semester", label: "Semester", roles: ["student", "club_admin"] },
  { key: "year", label: "Year", roles: ["student", "club_admin"] },
  { key: "roll_number", label: "Roll number", roles: ["student", "club_admin"] },
  { key: "position", label: "Position", roles: ["faculty"] },
  { key: "avatar_url", label: "Profile photo link", wide: true },
]

function Profile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [clubs, setClubs] = useState<ClubType[]>([])
  const [events, setEvents] = useState<EventType[]>([])

  const fields = FIELDS.filter((f) => !f.roles || (user && f.roles.includes(user.role)))

  useEffect(() => {
    if (!user) return
    const init: Record<string, string> = { bio: user.bio ?? "" }
    FIELDS.forEach((f) => (init[f.key] = (user as unknown as Record<string, string | undefined>)[f.key] ?? ""))
    setForm(init)
    ;(async () => {
      const [{ data: m }, { data: r }] = await Promise.all([
        supabase.from("club_members").select("club_id").eq("user_id", user.id),
        supabase.from("registrations").select("event_id").eq("user_id", user.id),
      ])
      const clubIds = ((m ?? []) as { club_id: number }[]).map((x) => x.club_id)
      const eventIds = ((r ?? []) as { event_id: number }[]).map((x) => x.event_id)
      if (clubIds.length) setClubs(((await supabase.from("clubs").select("*").in("id", clubIds)).data ?? []) as ClubType[])
      if (eventIds.length) setEvents(((await supabase.from("events").select("*").in("id", eventIds).order("date", { ascending: false })).data ?? []) as EventType[])
    })()
  }, [user])

  if (!user) return null

  const completion = Math.round((fields.filter((f) => (form[f.key] ?? "").trim()).length + ((form.bio ?? "").trim() ? 1 : 0)) / (fields.length + 1) * 100)

  const save = async () => {
    if (!form.name?.trim()) return toast({ title: "Name is required", variant: "destructive" })
    if (form.avatar_url && !safeUrl(form.avatar_url)) return toast({ title: "Invalid photo link", description: "Use an http(s) link.", variant: "destructive" })
    setSaving(true)
    const values: Record<string, string | null> = { bio: form.bio?.trim() || null }
    ;[...fields.map((f) => f.key)].forEach((k) => (values[k] = form[k]?.trim() || null))
    values.name = form.name.trim()
    const { error } = await supabase.from("users").update(values).eq("id", user.id)
    setSaving(false)
    if (error) return toast({ title: "Could not save profile", description: friendlyError(error), variant: "destructive" })
    await refreshUser()
    toast({ title: "Profile updated" })
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 py-6 lg:p-6">
      <PageHeader title="Profile" description="Your details are only visible to you and to organizers of events you register for." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit"><CardContent className="space-y-4 p-6 text-center">
          <Avatar className="mx-auto h-24 w-24"><AvatarImage src={safeUrl(user.avatar_url) ?? ""} alt="" /><AvatarFallback className="text-2xl">{(user.name || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          <div><h2 className="text-lg font-semibold">{user.name}</h2><p className="break-all text-sm text-muted-foreground">{user.email}</p></div>
          <Badge variant="secondary">{roleLabel[user.role] ?? user.role}</Badge>
          <div className="text-left"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Profile completion</span><span>{completion}%</span></div><Progress value={completion} aria-label="Profile completion" /></div>
        </CardContent></Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Edit profile</CardTitle><CardDescription>Email and role can&apos;t be changed here.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.key} className={`grid gap-1.5 ${f.wide ? "sm:col-span-2" : ""}`}>
                    <Label htmlFor={`p-${f.key}`}>{f.label}</Label>
                    <Input id={`p-${f.key}`} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  </div>
                ))}
                <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="p-bio">About you</Label><Textarea id="p-bio" rows={3} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-lg">My clubs</CardTitle></CardHeader><CardContent>
            {clubs.length === 0 ? <p className="text-sm text-muted-foreground">You haven&apos;t joined any clubs yet. <Link className="text-primary hover:underline" href="/clubs">Browse clubs</Link></p> : <div className="flex flex-wrap gap-2">{clubs.map((c) => <Button key={c.id} asChild variant="outline" size="sm"><Link href={`/clubs/${c.id}`}>{c.name}</Link></Button>)}</div>}
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-lg">My events</CardTitle></CardHeader><CardContent>
            {events.length === 0 ? <p className="text-sm text-muted-foreground">No registrations yet. <Link className="text-primary hover:underline" href="/events">Explore events</Link></p> : (
              <ul className="divide-y">{events.map((e) => <li key={e.id}><Link href={`/events/${e.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"><span className="truncate">{e.title}</span><span className="shrink-0 text-xs text-muted-foreground">{format(new Date(e.date), "d MMM yyyy")}</span></Link></li>)}</ul>
            )}
          </CardContent></Card>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return <RequireAuth message="Sign in to view your profile."><Profile /></RequireAuth>
}
