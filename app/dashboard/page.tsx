"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { Briefcase, CalendarDays, GraduationCap, Megaphone, MapPin, PackageSearch, ScrollText, ShoppingBag, Users, Building2, ArrowRight, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RequireAuth } from "@/components/campus/guards"
import { AnnouncementItem } from "@/components/campus/announcements-view"
import { EmptyState, ErrorState } from "@/components/campus/states"
import { useAuth } from "@/contexts/auth-context"
import { useRows } from "@/hooks/use-rows"
import { supabase, type AnnouncementType, type EventType, type OpportunityType } from "@/lib/supabase"
import { categoryLabel } from "@/lib/constants"
import { getEventStatus, isVisible, statusLabel } from "@/lib/event-utils"
import { isAdmin } from "@/lib/roles"
import { RemoteImage } from "@/components/campus/remote-image"

const QUICK = [
  { label: "Explore Events", href: "/events", icon: CalendarDays },
  { label: "Join Clubs", href: "/clubs", icon: Users },
  { label: "View Notices", href: "/notices", icon: ScrollText },
  { label: "Find Internships", href: "/internships", icon: GraduationCap },
  { label: "Placement Updates", href: "/placements", icon: Briefcase },
  { label: "Campus Services", href: "/services", icon: Building2 },
  { label: "Lost & Found", href: "/lost-found", icon: PackageSearch },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
]

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button asChild variant="ghost" size="sm"><Link href={href}>View all<ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const events = useRows<EventType>("events", { orderBy: "date", ascending: true })
  const announcements = useRows<AnnouncementType>("announcements", { eq: { is_published: true } })
  const opportunities = useRows<OpportunityType>("opportunities", { eq: { is_published: true, kind: "placement" } })
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase.from("registrations").select("event_id").eq("user_id", user.id).then(({ data }) => setRegisteredIds(new Set(((data ?? []) as { event_id: number }[]).map((r) => r.event_id))))
  }, [user])

  const upcoming = useMemo(() => events.rows.filter((e) => isVisible(e) && getEventStatus(e) !== "past").slice(0, 4), [events.rows])
  const latest = useMemo(() => announcements.rows.filter((a) => a.kind === "announcement").slice(0, 3), [announcements.rows])
  const notices = useMemo(() => {
    const rank = { urgent: 0, important: 1, normal: 2 } as const
    return announcements.rows.filter((a) => a.kind === "notice").sort((a, b) => rank[a.priority] - rank[b.priority] || +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 3)
  }, [announcements.rows])
  const openPlacements = useMemo(() => opportunities.rows.filter((o) => o.status !== "closed" && !(o.deadline && isPast(new Date(o.deadline)))), [opportunities.rows])
  const drives = openPlacements.filter((o) => o.category === "Placement Drive")

  const feed = useMemo(() => {
    const items = [
      ...events.rows.filter(isVisible).map((e) => ({ at: e.created_at, icon: CalendarDays, text: `New event: ${e.title}`, href: `/events/${e.id}` })),
      ...announcements.rows.map((a) => ({ at: a.created_at, icon: Megaphone, text: `${a.kind === "notice" ? "Notice" : "Announcement"}: ${a.title}`, href: a.kind === "notice" ? "/notices" : "/announcements" })),
      ...opportunities.rows.map((o) => ({ at: o.created_at, icon: Briefcase, text: `${o.company} – ${o.role}`, href: "/placements" })),
    ]
    return items.filter((i) => i.at).sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6)
  }, [events.rows, announcements.rows, opportunities.rows])

  const firstName = user?.name?.split(" ")[0] ?? "there"

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 py-6 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening around IIIT Ranchi.</p>
        </div>
        {isAdmin(user) && <Button asChild variant="outline"><Link href="/admin">Admin Dashboard</Link></Button>}
      </div>

      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <q.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden /><span>{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-labelledby="up">
          <div className="flex items-center justify-between"><h2 id="up" className="text-lg font-semibold">Upcoming events</h2><Button asChild variant="ghost" size="sm"><Link href="/events">View all<ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button></div>
          {events.loading ? <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : events.error ? <ErrorState message={events.error} onRetry={events.reload} /> : upcoming.length === 0 ? (
            <EmptyState title="No upcoming events" description="New events will show up here as soon as they're published." />
          ) : (
            <div className="space-y-3">
              {upcoming.map((e) => {
                const s = getEventStatus(e)
                return (
                  <Link key={e.id} href={`/events/${e.id}`} className="flex gap-4 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:block"><RemoteImage src={e.image || "/placeholder.svg"} alt="" sizes="112px" className="object-cover" /></div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-medium">{e.title}</h3><Badge variant="secondary" className="font-normal">{categoryLabel(e.category)}</Badge></div>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{format(new Date(e.date), "d MMM, h:mm a")}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{e.location}</span>
                        <span>By {e.organizer}</span>
                      </p>
                    </div>
                    <div className="shrink-0 self-center"><Badge variant={registeredIds.has(e.id) ? "default" : "outline"} className="font-normal">{registeredIds.has(e.id) ? "Registered" : statusLabel[s]}</Badge></div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="pl">
          <h2 id="pl" className="mb-3 text-lg font-semibold">Placement snapshot</h2>
          <Card><CardContent className="space-y-4 p-4">
            {opportunities.loading ? <Skeleton className="h-24 w-full" /> : opportunities.error ? <p className="text-sm text-muted-foreground">{opportunities.error}</p> : (
              <>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-md bg-muted p-3"><p className="text-2xl font-semibold">{openPlacements.length}</p><p className="text-xs text-muted-foreground">Active opportunities</p></div>
                  <div className="rounded-md bg-muted p-3"><p className="text-2xl font-semibold">{drives.length}</p><p className="text-xs text-muted-foreground">Upcoming drives</p></div>
                </div>
                {opportunities.rows.length === 0 ? <p className="text-sm text-muted-foreground">No placement announcements yet.</p> : (
                  <ul className="space-y-2 text-sm">{opportunities.rows.slice(0, 3).map((o) => <li key={o.id} className="flex justify-between gap-2"><span className="truncate">{o.company} – {o.role}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span></li>)}</ul>
                )}
                <Button asChild variant="outline" size="sm" className="w-full"><Link href="/placements">Placement updates</Link></Button>
              </>
            )}
          </CardContent></Card>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="ann">
          <SectionHeader title="Latest announcements" href="/announcements" />
          {announcements.loading ? <Skeleton className="h-28 w-full" /> : announcements.error ? <ErrorState message={announcements.error} onRetry={announcements.reload} /> : latest.length === 0 ? <EmptyState title="No announcements yet" /> : <div className="space-y-3">{latest.map((a) => <AnnouncementItem key={a.id} a={a} />)}</div>}
        </section>
        <section aria-labelledby="not">
          <SectionHeader title="Important notices" href="/notices" />
          {announcements.loading ? <Skeleton className="h-28 w-full" /> : notices.length === 0 ? <EmptyState title="No notices right now" /> : <div className="space-y-3">{notices.map((a) => <AnnouncementItem key={a.id} a={a} />)}</div>}
        </section>
      </div>

      <section aria-labelledby="feed">
        <h2 id="feed" className="mb-3 text-lg font-semibold">Campus updates</h2>
        <Card><CardContent className="p-0">
          {feed.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Recent activity will appear here.</p> : (
            <ul className="divide-y">{feed.map((f, i) => (
              <li key={i}><Link href={f.href} className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50"><f.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0 flex-1 truncate">{f.text}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.at), { addSuffix: true })}</span></Link></li>
            ))}</ul>
          )}
        </CardContent></Card>
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return <RequireAuth message="Sign in to see your CampusOne dashboard."><Dashboard /></RequireAuth>
}
