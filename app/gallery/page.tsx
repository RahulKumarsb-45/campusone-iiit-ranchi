"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/campus/page-header"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import { safeUrl } from "@/lib/data"
import { GALLERY_CATEGORIES } from "@/lib/constants"
import type { GalleryType } from "@/lib/supabase"
import { RemoteImage } from "@/components/campus/remote-image"

export default function GalleryPage() {
  const { rows, loading, error, reload } = useRows<GalleryType>("gallery_items")
  const [category, setCategory] = useState("all")
  const [open, setOpen] = useState<GalleryType | null>(null)
  const items = useMemo(() => rows.filter((r) => safeUrl(r.image_url) && (category === "all" || r.category === category)), [rows, category])

  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader title="Gallery" description="Moments from events, clubs and campus life." />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter gallery">
        {["all", ...GALLERY_CATEGORIES].map((c) => (
          <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)} aria-pressed={category === c}>{c === "all" ? "All" : c}</Button>
        ))}
      </div>
      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title="No photos yet" description="Photos added by the administration and club admins will appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View ${p.title}`}>
              <RemoteImage src={safeUrl(p.image_url)!} alt={p.title} sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-xs text-white">{p.title}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{open?.title}</DialogTitle>
          <DialogDescription>{open?.caption ?? open?.category ?? ""}</DialogDescription>
          {open && <div className="relative h-[70vh] w-full"><RemoteImage src={safeUrl(open.image_url)!} alt={open.title} sizes="768px" className="rounded-md object-contain" /></div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
