"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, Info, Paperclip, Search, Siren } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/campus/page-header"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import { safeUrl } from "@/lib/data"
import { cn } from "@/lib/utils"
import type { AnnouncementType } from "@/lib/supabase"

export const priorityMeta = {
  normal: { label: "Normal", icon: Info, cls: "border-l-border" },
  important: { label: "Important", icon: AlertTriangle, cls: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20" },
  urgent: { label: "Urgent", icon: Siren, cls: "border-l-red-600 bg-red-50/60 dark:bg-red-950/20" },
} as const

export function AnnouncementItem({ a }: { a: AnnouncementType }) {
  const meta = priorityMeta[a.priority] ?? priorityMeta.normal
  const Icon = meta.icon
  const attachment = safeUrl(a.attachment_url)
  return (
    <article className={cn("rounded-lg border border-l-4 bg-card p-4", meta.cls)}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {a.priority !== "normal" && (
          <Badge variant={a.priority === "urgent" ? "destructive" : "secondary"} className="gap-1"><Icon className="h-3 w-3" aria-hidden />{meta.label}</Badge>
        )}
        {a.category && <Badge variant="outline" className="font-normal">{a.category}</Badge>}
        <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "d MMM yyyy")}{a.author_name ? ` · ${a.author_name}` : ""}</span>
      </div>
      <h2 className="text-base font-semibold">{a.title}</h2>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
      {attachment && (
        <a href={attachment} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />View attachment
        </a>
      )}
    </article>
  )
}

export function AnnouncementsView({ kind }: { kind: "announcement" | "notice" }) {
  const { rows, loading, error, reload } = useRows<AnnouncementType>("announcements", { eq: { kind, is_published: true } })
  const [query, setQuery] = useState("")
  const [priority, setPriority] = useState("all")

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rank = { urgent: 0, important: 1, normal: 2 } as const
    return rows
      .filter((a) => priority === "all" || a.priority === priority)
      .filter((a) => !q || [a.title, a.body, a.category].some((v) => (v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => rank[a.priority] - rank[b.priority] || +new Date(b.created_at) - +new Date(a.created_at))
  }, [rows, query, priority])

  const label = kind === "notice" ? "Notices" : "Announcements"
  return (
    <div className="mx-auto w-full max-w-4xl p-4 py-6 lg:p-6">
      <PageHeader title={label} description={kind === "notice" ? "Official notices from IIIT Ranchi." : "Latest news and updates around campus."} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="important">Important</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title={`No ${label.toLowerCase()} yet`} description="New posts from the administration will appear here." />
      ) : (
        <div className="space-y-3">{items.map((a) => <AnnouncementItem key={a.id} a={a} />)}</div>
      )}
    </div>
  )
}
