"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClubLogo } from "@/components/campus/club-logo"
import { PageHeader } from "@/components/campus/page-header"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import type { ClubType } from "@/lib/supabase"

export default function ClubsPage() {
  const { rows, loading, error, reload } = useRows<ClubType>("clubs", { orderBy: "name", ascending: true, eq: { is_published: true } })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const categories = useMemo(() => Array.from(new Set(rows.map((c) => c.category).filter(Boolean) as string[])).sort(), [rows])
  const clubs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((c) => (category === "all" || c.category === category) && (!q || [c.name, c.description, c.category].some((v) => (v ?? "").toLowerCase().includes(q))))
  }, [rows, query, category])

  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader title="Clubs" description="Student clubs and communities at IIIT Ranchi." />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search clubs" placeholder="Search clubs…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : clubs.length === 0 ? (
        <EmptyState title="No clubs found" description={rows.length === 0 ? "Clubs will be listed here once an administrator adds them." : "Try a different search or category."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clubs.map((c) => (
            <Link key={c.id} href={`/clubs/${c.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex gap-4 p-4">
                  <ClubLogo club={c} />
                  <div className="min-w-0 space-y-1.5">
                    <h2 className="truncate font-semibold">{c.name}</h2>
                    {c.category && <Badge variant="secondary" className="font-normal">{c.category}</Badge>}
                    {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
