"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Briefcase, CalendarDays, Megaphone, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EventCard } from "@/components/event-card"
import { AnnouncementItem } from "@/components/campus/announcements-view"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useAuth } from "@/contexts/auth-context"
import { useRows } from "@/hooks/use-rows"
import { BRAND } from "@/lib/brand"
import { getEventStatus, isVisible } from "@/lib/event-utils"
import type { AnnouncementType, EventType } from "@/lib/supabase"

const FEATURES = [
  { icon: CalendarDays, title: "Events", text: "Discover and register for technical, cultural and sports events.", href: "/events" },
  { icon: Users, title: "Clubs", text: "Find your community and follow what your clubs are up to.", href: "/clubs" },
  { icon: Megaphone, title: "Announcements & Notices", text: "Official updates from the institute in one place.", href: "/announcements" },
  { icon: Briefcase, title: "Placements & Internships", text: "Track drives, openings and deadlines.", href: "/placements" },
]

export default function HomePage() {
  const { user } = useAuth()
  const events = useRows<EventType>("events", { orderBy: "date", ascending: true })
  const announcements = useRows<AnnouncementType>("announcements", { eq: { kind: "announcement", is_published: true }, limit: 3 })
  const upcoming = useMemo(() => events.rows.filter((e) => isVisible(e) && getEventStatus(e) !== "past").slice(0, 3), [events.rows])

  return (
    <div>
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16 lg:px-6">
          <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">{BRAND.collegeFull}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{BRAND.name}</h1>
          <p className="mt-3 max-w-2xl text-base text-primary-foreground/90 sm:text-lg">{BRAND.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Button asChild variant="secondary" size="lg"><Link href="/dashboard">Go to dashboard<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></Link></Button>
            ) : (
              <>
                <Button asChild variant="secondary" size="lg"><Link href="/auth/login">Sign in</Link></Button>
                <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link href="/auth/register">Create account</Link></Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 lg:px-6">
        <section aria-label="What you can do">
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="flex gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div><h2 className="font-medium">{f.title}</h2><p className="text-sm text-muted-foreground">{f.text}</p></div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="home-events">
          <div className="mb-4 flex items-center justify-between"><h2 id="home-events" className="text-xl font-semibold">Upcoming events</h2><Button asChild variant="ghost" size="sm"><Link href="/events">All events<ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button></div>
          {events.loading ? <CardGridSkeleton count={3} /> : events.error ? <ErrorState message={events.error} onRetry={events.reload} /> : upcoming.length === 0 ? <EmptyState title="No upcoming events" description="New events will appear here once they're published." /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
          )}
        </section>

        {announcements.rows.length > 0 && (
          <section aria-labelledby="home-ann">
            <div className="mb-4 flex items-center justify-between"><h2 id="home-ann" className="text-xl font-semibold">Latest announcements</h2><Button asChild variant="ghost" size="sm"><Link href="/announcements">All announcements<ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button></div>
            <div className="space-y-3">{announcements.rows.map((a) => <AnnouncementItem key={a.id} a={a} />)}</div>
          </section>
        )}
      </div>
    </div>
  )
}
