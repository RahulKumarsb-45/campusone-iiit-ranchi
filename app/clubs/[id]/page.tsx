"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Mail, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { EventCard } from "@/components/event-card"
import { EmptyState, ErrorState } from "@/components/campus/states"
import { ClubLogo } from "@/components/campus/club-logo"
import { useAuth } from "@/contexts/auth-context"
import { friendlyError, getRow, safeUrl } from "@/lib/data"
import { getEventStatus, isVisible } from "@/lib/event-utils"
import { supabase, type ClubType, type EventType, type GalleryType } from "@/lib/supabase"
import { RemoteImage } from "@/components/campus/remote-image"

export default function ClubPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [club, setClub] = useState<ClubType | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<number | null>(null)
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<EventType[]>([])
  const [photos, setPhotos] = useState<GalleryType[]>([])

  const load = useCallback(async () => {
    const res = await getRow<ClubType>("clubs", id)
    if (res.error) return setError(res.error)
    setClub(res.data)
    if (!res.data) return
    supabase.rpc("club_member_count", { p_club_id: res.data.id }).then(({ data, error }) => setMembers(error ? null : (data as number)))
    supabase.from("events").select("*").eq("club_id", res.data.id).order("date", { ascending: false }).then(({ data }) => setEvents(((data ?? []) as EventType[]).filter(isVisible)))
    supabase.from("gallery_items").select("*").eq("club_id", res.data.id).order("created_at", { ascending: false }).limit(8).then(({ data }) => setPhotos((data ?? []) as GalleryType[]))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user || !club) return setJoined(false)
    supabase.from("club_members").select("id").eq("club_id", club.id).eq("user_id", user.id).maybeSingle().then(({ data }) => setJoined(!!data))
  }, [user, club])

  const toggleMembership = async () => {
    if (!club || !user) return
    setBusy(true)
    const { error } = joined
      ? await supabase.from("club_members").delete().eq("club_id", club.id).eq("user_id", user.id)
      : await supabase.from("club_members").insert([{ club_id: club.id, user_id: user.id }])
    setBusy(false)
    if (error && error.code !== "23505") return toast({ title: joined ? "Could not leave club" : "Could not join club", description: friendlyError(error), variant: "destructive" })
    setMembers((m) => (m ?? 0) + (joined ? -1 : 1))
    setJoined(!joined)
    toast({ title: joined ? `You left ${club.name}` : `Welcome to ${club.name}` })
  }

  if (error) return <div className="mx-auto max-w-xl p-6"><ErrorState message={error} onRetry={load} /></div>
  if (club === undefined) return <div className="mx-auto max-w-4xl space-y-4 p-6" aria-busy="true"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>
  if (!club || !club.is_published) return <div className="mx-auto max-w-xl p-6"><EmptyState title="Club not found" action={<Button asChild><Link href="/clubs">All clubs</Link></Button>} /></div>

  const upcoming = events.filter((e) => getEventStatus(e) !== "past").reverse()
  const past = events.filter((e) => getEventStatus(e) === "past")

  return (
    <div className="mx-auto w-full max-w-5xl p-4 py-6 lg:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/clubs"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden />All clubs</Link></Button>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
        <ClubLogo club={club} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{club.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {club.category && <Badge variant="secondary">{club.category}</Badge>}
            <span className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" aria-hidden />{members ?? "–"} members</span>
          </div>
          {club.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{club.description}</p>}
          <dl className="mt-3 grid gap-1 text-sm">
            {club.faculty_coordinator && <div><dt className="inline text-muted-foreground">Faculty coordinator: </dt><dd className="inline">{club.faculty_coordinator}</dd></div>}
            {club.student_leads && <div><dt className="inline text-muted-foreground">Student leads: </dt><dd className="inline">{club.student_leads}</dd></div>}
            {club.contact_email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /><a className="text-primary hover:underline" href={`mailto:${club.contact_email}`}>{club.contact_email}</a></div>}
          </dl>
          <div className="mt-4">
            {user ? (
              <Button onClick={toggleMembership} disabled={busy} variant={joined ? "outline" : "default"}>{joined ? "Leave club" : "Join club"}</Button>
            ) : (
              <Button asChild><Link href="/auth/login">Sign in to join</Link></Button>
            )}
          </div>
        </div>
      </div>

      <section className="mb-8" aria-labelledby="upcoming"><h2 id="upcoming" className="mb-3 text-lg font-semibold">Upcoming events</h2>
        {upcoming.length === 0 ? <EmptyState title="No upcoming events" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>}
      </section>
      {past.length > 0 && <section className="mb-8" aria-labelledby="past"><h2 id="past" className="mb-3 text-lg font-semibold">Past events</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div></section>}
      {photos.length > 0 && (
        <section aria-labelledby="gal"><h2 id="gal" className="mb-3 text-lg font-semibold">Gallery</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => safeUrl(p.image_url) && (
              <div key={p.id} className="relative aspect-square w-full overflow-hidden rounded-md bg-muted"><RemoteImage src={safeUrl(p.image_url)!} alt={p.title} sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" /></div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
