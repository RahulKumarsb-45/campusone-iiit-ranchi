"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { ArrowLeft, Calendar, Clock, ExternalLink, MapPin, Pencil, Phone, Trash2, User, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { EventCard } from "@/components/event-card"
import { VolunteerForm } from "@/components/volunteer-form"
import { EmptyState, ErrorState } from "@/components/campus/states"
import { useAuth } from "@/contexts/auth-context"
import { fetchEventById, fetchEvents, registerForEvent, supabase, updateEvent, type EventType } from "@/lib/supabase"
import { deleteRow, safeUrl } from "@/lib/data"
import { categoryLabel } from "@/lib/constants"
import { getEventStatus, statusLabel } from "@/lib/event-utils"
import { isAdmin } from "@/lib/roles"
import { RemoteImage } from "@/components/campus/remote-image"

type Registrant = { id: number; user_id: string; is_volunteer: boolean; volunteer_role?: string; registration_date: string; name?: string; email?: string }

export default function EventPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const id = Number(params.id)

  const [event, setEvent] = useState<EventType | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [registered, setRegistered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [related, setRelated] = useState<EventType[]>([])
  const [registrants, setRegistrants] = useState<Registrant[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showVolunteer, setShowVolunteer] = useState(false)

  const canManage = !!event && !!user && (isAdmin(user) || event.user_id === user.id)

  const load = useCallback(async () => {
    if (!Number.isInteger(id)) return setState("missing")
    try {
      const lookup = await fetchEventById(id)
      if (lookup.status === "error") return setState("error")
      if (lookup.status === "not_found") return setState("missing")
      const e = lookup.event
      setEvent(e)
      setState("ready")
      fetchEvents({ category: e.category, upcoming: true, limit: 4, orderBy: "date" }).then((r) =>
        setRelated((r ?? []).filter((x) => x.id !== e.id && x.is_published !== false).slice(0, 3)),
      )
    } catch {
      setState("error")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!user || !event) return setRegistered(false)
    supabase
      .from("registrations")
      .select("id")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setRegistered(!!data))
  }, [user, event])

  const loadRegistrants = useCallback(async () => {
    if (!event) return
    const { data: regs } = await supabase.from("registrations").select("*").eq("event_id", event.id).order("registration_date")
    const list = (regs ?? []) as Registrant[]
    const ids = Array.from(new Set(list.map((r) => r.user_id)))
    if (ids.length) {
      const { data: people } = await supabase.from("users").select("id,name,email").in("id", ids)
      const map = new Map(((people ?? []) as { id: string; name?: string; email?: string }[]).map((p) => [p.id, p] as const))
      list.forEach((r) => {
        const p = map.get(r.user_id)
        r.name = p?.name
        r.email = p?.email
      })
    }
    setRegistrants(list)
  }, [event])

  useEffect(() => {
    if (canManage) loadRegistrants()
  }, [canManage, loadRegistrants])

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 py-6 lg:p-6" aria-busy="true" aria-label="Loading event">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (state === "error") return <div className="mx-auto max-w-xl p-6"><ErrorState message="We couldn't load this event. Please try again." onRetry={load} /></div>
  if (state === "missing" || !event || (event.is_published === false && !canManage)) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState title="Event not found" description="This event doesn't exist or is no longer available." action={<Button asChild><Link href="/events">Browse events</Link></Button>} />
      </div>
    )
  }

  const status = getEventStatus(event)
  const start = new Date(event.date)
  const spots = event.max_participants > 0 ? Math.max(event.max_participants - (event.current_participants ?? 0), 0) : null
  const pct = event.max_participants > 0 ? Math.min(100, ((event.current_participants ?? 0) / event.max_participants) * 100) : 0
  const external = safeUrl(event.registration_link)

  const handleRegister = async () => {
    if (!user) return router.push("/auth/login")
    if (external) return void window.open(external, "_blank", "noopener,noreferrer")
    setBusy(true)
    const res = await registerForEvent(event.id)
    setBusy(false)
    if ("error" in res) {
      toast({ title: res.error === "Already registered" ? "Already registered" : "Registration failed", description: res.error === "Already registered" ? "You are already registered for this event." : res.error, variant: "destructive" })
      if (res.error === "Already registered") setRegistered(true)
      return
    }
    setRegistered(true)
    setEvent({ ...event, current_participants: (event.current_participants ?? 0) + 1 })
    toast({ title: "You're registered", description: event.title })
    const { data } = await supabase.auth.getSession()
    if (data.session)
      fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ type: "registration", eventId: event.id }) }).catch(() => {})
  }

  const handleCancel = async () => {
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from("registrations").delete().eq("event_id", event.id).eq("user_id", user.id)
    if (error) {
      setBusy(false)
      return toast({ title: "Could not cancel", description: "Please try again.", variant: "destructive" })
    }
    const next = Math.max((event.current_participants ?? 1) - 1, 0)
    setBusy(false)
    setRegistered(false)
    setEvent({ ...event, current_participants: next })
    toast({ title: "Registration cancelled" })
  }

  const togglePublish = async (value: boolean) => {
    const res = await updateEvent(event.id, { is_published: value })
    if (res.error !== null) return toast({ title: "Could not update", description: res.error, variant: "destructive" })
    setEvent({ ...event, is_published: value })
    toast({ title: value ? "Event published" : "Event unpublished" })
  }

  const removeEvent = async () => {
    const res = await deleteRow("events", event.id)
    setConfirmDelete(false)
    if (res.error) return toast({ title: "Could not delete event", description: res.error, variant: "destructive" })
    toast({ title: "Event deleted" })
    router.push("/events")
  }

  const removeRegistrant = async (r: Registrant) => {
    const { error } = await supabase.from("registrations").delete().eq("id", r.id)
    if (error) return toast({ title: "Could not remove", description: "You may not have permission.", variant: "destructive" })
    if (!r.is_volunteer) setEvent({ ...event, current_participants: Math.max((event.current_participants ?? 1) - 1, 0) })
    loadRegistrants()
  }

  const canRegister = status === "open"

  return (
    <div className="mx-auto w-full max-w-5xl p-4 py-6 lg:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/events"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden />All events</Link></Button>

      <div className="relative mb-6 aspect-[21/9] overflow-hidden rounded-lg bg-muted">
        <RemoteImage src={event.image || "/placeholder.svg"} alt="" fallbackSrc="/placeholder.svg" sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge>{categoryLabel(event.category)}</Badge>
            <Badge variant={status === "open" ? "default" : "outline"}>{statusLabel[status]}</Badge>
            {event.is_published === false && <Badge variant="secondary">Unpublished</Badge>}
            {event.is_paid && <Badge variant="outline">₹{event.price}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{event.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organized by {event.organizer}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm"><Link href={`/events/${event.id}/edit`}><Pencil className="mr-2 h-4 w-4" aria-hidden />Edit</Link></Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden />Delete</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">About this event</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p className="whitespace-pre-line">{event.description}</p>
              {event.long_description && <p className="whitespace-pre-line">{event.long_description}</p>}
              {event.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">{event.tags.map((t) => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Organizers</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              {[["Organizer", event.organizer], ["Lead organizer", event.lead_organizer], ["Convener", event.convener], ["Coordinator", event.coordinator]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2"><User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><div><p className="text-xs text-muted-foreground">{k}</p><p>{v}</p></div></div>
              ))}
              {event.contact_number && (
                <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><div><p className="text-xs text-muted-foreground">Contact</p><p>{event.contact_number}</p></div></div>
              )}
            </CardContent>
          </Card>

          {event.needs_volunteers && event.volunteer_roles && event.volunteer_roles.length > 0 && !canManage && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Volunteer</CardTitle></CardHeader>
              <CardContent>
                {showVolunteer ? (
                  user ? <VolunteerForm eventId={event.id} eventTitle={event.title} eventDate={start} volunteerRoles={event.volunteer_roles} /> : <p className="text-sm text-muted-foreground">Please <Link className="underline" href="/auth/login">sign in</Link> to volunteer.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">This event is looking for volunteers.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowVolunteer(true)}>Apply</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg">Registrations ({registrants?.length ?? "…"})</CardTitle>
                <div className="flex items-center gap-2">
                  {isAdmin(user) ? (
                    <>
                      <Switch id="publish" checked={event.is_published !== false} onCheckedChange={togglePublish} />
                      <Label htmlFor="publish" className="text-sm">Published</Label>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{event.is_published === false ? "Pending admin approval" : "Published"}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!registrants ? <Skeleton className="h-20 w-full" /> : registrants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No registrations yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Type</TableHead><TableHead className="w-12"><span className="sr-only">Remove</span></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {registrants.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.name ?? "—"}</TableCell>
                            <TableCell className="max-w-[12rem] truncate">{r.email ?? "—"}</TableCell>
                            <TableCell>{r.is_volunteer ? `Volunteer${r.volunteer_role ? ` (${r.volunteer_role})` : ""}` : "Participant"}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" aria-label="Remove registration" onClick={() => removeRegistrant(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 text-sm">
              <div className="flex items-start gap-3"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><div><p className="font-medium">{format(start, "EEEE, d MMMM yyyy")}</p></div></div>
              <div className="flex items-start gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><p>{format(start, "h:mm a")}{event.end_date ? ` – ${format(new Date(event.end_date), "h:mm a")}` : ""}</p></div>
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><div><p>{event.location}</p>{event.address && <p className="text-muted-foreground">{event.address}</p>}</div></div>
              {event.registration_deadline && (
                <p className="text-muted-foreground">Register by {format(new Date(event.registration_deadline), "d MMM yyyy, h:mm a")}</p>
              )}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{event.current_participants ?? 0} registered</span>
                  {spots !== null && <span>{spots} spots left</span>}
                </div>
                {event.max_participants > 0 && <Progress value={pct} aria-label="Capacity" />}
              </div>

              {registered ? (
                <div className="space-y-2">
                  <Badge className="w-full justify-center py-1.5">You&apos;re registered</Badge>
                  {status !== "past" && status !== "ongoing" && <Button variant="outline" className="w-full" onClick={handleCancel} disabled={busy}>Cancel registration</Button>}
                </div>
              ) : (
                <Button className="w-full" onClick={handleRegister} disabled={busy || !canRegister}>
                  {external && canRegister && <ExternalLink className="mr-2 h-4 w-4" aria-hidden />}
                  {!canRegister ? statusLabel[status] : user ? (external ? "Register on external site" : busy ? "Registering…" : "Register") : "Sign in to register"}
                </Button>
              )}
              {event.is_paid && <p className="text-xs text-muted-foreground">Paid event (₹{event.price}). Payment is coordinated by the organizers; contact them for details.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="related">
          <h2 id="related" className="mb-4 text-lg font-semibold">Related events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{event.title}&quot; and its registrations will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={removeEvent}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
