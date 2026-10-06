"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Briefcase, CalendarDays, GraduationCap, Megaphone, PackageSearch, ShoppingBag, Users, UserRound, CalendarClock, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/campus/page-header"
import { countRows } from "@/lib/data"

type Stat = { label: string; href: string; icon: LucideIcon; load: () => Promise<number | null> }

const now = () => new Date().toISOString()
const STATS: Stat[] = [
  { label: "Total students", href: "/admin/users", icon: UserRound, load: () => countRows("users", (q) => q.eq("role", "student")) },
  { label: "Total events", href: "/admin/events", icon: CalendarDays, load: () => countRows("events") },
  { label: "Upcoming events", href: "/admin/events", icon: CalendarClock, load: () => countRows("events", (q) => q.gte("date", now())) },
  { label: "Total clubs", href: "/admin/clubs", icon: Users, load: () => countRows("clubs") },
  { label: "Active announcements", href: "/admin/announcements", icon: Megaphone, load: () => countRows("announcements", (q) => q.eq("is_published", true)) },
  { label: "Placement opportunities", href: "/admin/placements", icon: Briefcase, load: () => countRows("opportunities", (q) => q.eq("kind", "placement").eq("status", "open")) },
  { label: "Internship opportunities", href: "/admin/internships", icon: GraduationCap, load: () => countRows("opportunities", (q) => q.eq("kind", "internship").eq("status", "open")) },
  { label: "Lost & Found reports", href: "/admin/lost-found", icon: PackageSearch, load: () => countRows("lost_found_items") },
  { label: "Marketplace listings", href: "/admin/marketplace", icon: ShoppingBag, load: () => countRows("marketplace_listings", (q) => q.eq("status", "available")) },
]

export default function AdminOverview() {
  const [values, setValues] = useState<(number | null | undefined)[]>(STATS.map(() => undefined))

  useEffect(() => {
    STATS.forEach((s, i) => s.load().then((v) => setValues((prev) => prev.map((p, j) => (j === i ? v : p)))))
  }, [])

  return (
    <>
      <PageHeader title="Admin Dashboard" description="Overview of everything on CampusOne – IIIT Ranchi." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map((s, i) => (
          <Link key={s.label} href={s.href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="transition-colors hover:border-primary/40"><CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-md bg-primary/10 p-2.5 text-primary"><s.icon className="h-5 w-5" aria-hidden /></div>
              <div>
                {values[i] === undefined ? <Skeleton className="h-7 w-10" /> : <p className="text-2xl font-semibold">{values[i] ?? "–"}</p>}
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </CardContent></Card>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">A “–” means the count couldn&apos;t be loaded (for example, the CampusOne database migration hasn&apos;t been applied yet).</p>
    </>
  )
}
