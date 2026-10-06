"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EventCard } from "@/components/event-card"
import { PageHeader } from "@/components/campus/page-header"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import { useAuth } from "@/contexts/auth-context"
import { canManageEvents } from "@/lib/roles"
import { EVENT_CATEGORIES } from "@/lib/constants"
import { getEventStatus, isVisible } from "@/lib/event-utils"
import type { EventType } from "@/lib/supabase"

export default function EventsPage() {
  const { user } = useAuth()
  const { rows, loading, error, reload } = useRows<EventType>("events", { orderBy: "date", ascending: true })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming")

  const events = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows
      .filter((e) => isVisible(e) || user?.role === "admin" || e.user_id === user?.id)
      .filter((e) => (when === "past") === (getEventStatus(e) === "past"))
      .filter((e) => category === "all" || e.category === category)
      .filter(
        (e) =>
          !q ||
          [e.title, e.description, e.organizer, e.location, ...(e.tags ?? [])].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
    return when === "past" ? [...list].reverse() : list
  }, [rows, query, category, when, user])

  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader
        title="Events"
        description="Technical, cultural, sports and academic events at IIIT Ranchi."
        actions={
          canManageEvents(user) && (
            <Button asChild><Link href="/events/create"><Plus className="mr-2 h-4 w-4" aria-hidden />Create event</Link></Button>
          )
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={when} onValueChange={(v) => setWhen(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search events" placeholder="Search by title, organizer, venue or tag…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full md:w-48" aria-label="Filter by category"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EVENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : events.length === 0 ? (
        <EmptyState
          title={when === "upcoming" ? "No upcoming events" : "No past events"}
          description={query || category !== "all" ? "Try clearing your search or filters." : "Check back soon – new events are added regularly."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  )
}
