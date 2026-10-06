"use client"

import { useMemo, useState } from "react"
import { format, isPast } from "date-fns"
import { Building2, CalendarClock, ExternalLink, MapPin, Search, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/campus/page-header"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import { safeUrl } from "@/lib/data"
import { OPPORTUNITY_CATEGORIES, WORK_MODES } from "@/lib/constants"
import type { OpportunityType } from "@/lib/supabase"

export function OpportunityCard({ o }: { o: OpportunityType }) {
  const link = safeUrl(o.apply_url)
  const expired = (o.deadline && isPast(new Date(o.deadline))) || o.status === "closed"
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{o.company}</span></p>
            <h2 className="mt-0.5 text-base font-semibold leading-snug">{o.role}</h2>
          </div>
          <Badge variant={expired ? "outline" : o.status === "upcoming" ? "secondary" : "default"}>{expired ? "Closed" : o.status === "upcoming" ? "Upcoming" : "Open"}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {o.category && <Badge variant="secondary" className="font-normal">{o.category}</Badge>}
          {o.work_mode && <Badge variant="outline" className="font-normal capitalize">{WORK_MODES.find((m) => m.value === o.work_mode)?.label ?? o.work_mode}</Badge>}
          {o.domain && <Badge variant="outline" className="font-normal">{o.domain}</Badge>}
        </div>
        <dl className="grid gap-1 text-sm text-muted-foreground">
          {o.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{o.location}</dd></div>}
          {o.stipend && <div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{o.stipend}{o.duration ? ` · ${o.duration}` : ""}</dd></div>}
          {!o.stipend && o.duration && <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{o.duration}</dd></div>}
          {o.deadline && <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /><dd>Apply by {format(new Date(o.deadline), "d MMM yyyy")}</dd></div>}
        </dl>
        {(o.eligibility || o.batch || o.min_cgpa != null) && (
          <p className="text-xs text-muted-foreground">
            {[o.eligibility, o.batch && `Batch ${o.batch}`, o.min_cgpa != null && `Min CGPA ${o.min_cgpa}`].filter(Boolean).join(" · ")}
          </p>
        )}
        {o.skills?.length > 0 && <div className="flex flex-wrap gap-1">{o.skills.slice(0, 6).map((s) => <Badge key={s} variant="outline" className="text-xs font-normal">{s}</Badge>)}</div>}
        <div className="mt-auto pt-2">
          {link && !expired ? (
            <Button asChild size="sm" className="w-full"><a href={link} target="_blank" rel="noopener noreferrer">Apply<ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden /></a></Button>
          ) : (
            <Button size="sm" variant="outline" className="w-full" disabled>{expired ? "Applications closed" : "No link yet"}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function OpportunitiesView({ kind }: { kind: "placement" | "internship" }) {
  const { rows, loading, error, reload } = useRows<OpportunityType>("opportunities", { eq: { kind, is_published: true } })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [mode, setMode] = useState("all")
  const [domain, setDomain] = useState("all")
  const [showClosed, setShowClosed] = useState(false)

  const domains = useMemo(() => Array.from(new Set(rows.map((r) => r.domain).filter(Boolean) as string[])).sort(), [rows])
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((o) => showClosed || !(o.status === "closed" || (o.deadline && isPast(new Date(o.deadline)))))
      .filter((o) => category === "all" || o.category === category)
      .filter((o) => mode === "all" || o.work_mode === mode)
      .filter((o) => domain === "all" || o.domain === domain)
      .filter((o) => !q || [o.company, o.role, o.location, ...(o.skills ?? [])].some((v) => (v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => +new Date(a.deadline ?? "2999-01-01") - +new Date(b.deadline ?? "2999-01-01"))
  }, [rows, query, category, mode, domain, showClosed])

  const isIntern = kind === "internship"
  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader title={isIntern ? "Internships" : "Placements"} description={isIntern ? "Internship openings shared with IIIT Ranchi students." : "Placement drives and full-time opportunities for IIIT Ranchi students."} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search" placeholder="Search company, role, skill or location…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {isIntern ? (
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger aria-label="Work mode"><SelectValue placeholder="Work mode" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Any work mode</SelectItem>{WORK_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{OPPORTUNITY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger aria-label="Domain"><SelectValue placeholder="Domain" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All domains</SelectItem>{domains.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant={showClosed ? "secondary" : "outline"} onClick={() => setShowClosed(!showClosed)} aria-pressed={showClosed}>{showClosed ? "Hide closed" : "Show closed"}</Button>
      </div>
      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title={`No ${isIntern ? "internships" : "placement opportunities"} found`} description="Try adjusting your filters, or check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((o) => <OpportunityCard key={o.id} o={o} />)}</div>
      )}
    </div>
  )
}
