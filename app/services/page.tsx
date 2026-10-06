"use client"

import { useMemo, useState } from "react"
import { Clock, MapPin, Phone, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/campus/page-header"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import type { ServiceType } from "@/lib/supabase"

export default function ServicesPage() {
  const { rows, loading, error, reload } = useRows<ServiceType>("campus_services", { orderBy: "title", ascending: true, eq: { is_published: true } })
  const [query, setQuery] = useState("")
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((s) => !q || [s.title, s.category, s.description, s.location].some((v) => (v ?? "").toLowerCase().includes(q)))
  }, [rows, query])

  return (
    <div className="mx-auto w-full max-w-6xl p-4 py-6 lg:p-6">
      <PageHeader title="Campus Services" description="Hostel, mess, library, medical, transport and other facilities at IIIT Ranchi." />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search services" placeholder="Search services…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading ? <CardGridSkeleton count={3} /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title="No services listed" description={rows.length === 0 ? "Service details and contacts will appear here once the administration adds them." : "Try a different search."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <Card key={s.id}><CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{s.title}</h2>{s.category && <Badge variant="secondary" className="font-normal">{s.category}</Badge>}</div>
              {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
              <dl className="space-y-1 text-sm">
                {s.location && <div className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /><dd>{s.location}</dd></div>}
                {s.timings && <div className="flex gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /><dd>{s.timings}</dd></div>}
                {s.contact && <div className="flex gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /><dd>{s.contact}</dd></div>}
              </dl>
              {s.important_info && <p className="rounded-md bg-muted p-2 text-xs">{s.important_info}</p>}
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}
