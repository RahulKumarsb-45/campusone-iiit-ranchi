"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Calendar, Clock, MapPin, Share2, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import type { EventType } from "@/lib/supabase"
import { categoryLabel } from "@/lib/constants"
import { getEventStatus, statusLabel } from "@/lib/event-utils"
import { RemoteImage } from "@/components/campus/remote-image"

export function EventCard({ event, className }: { event: EventType; className?: string }) {
  const start = new Date(event.date)
  const status = getEventStatus(event)

  const shareEvent = async () => {
    const url = `${window.location.origin}/events/${event.id}`
    try {
      if (navigator.share) await navigator.share({ title: event.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast({ title: "Link copied", description: "Event link copied to your clipboard." })
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      <div className="relative aspect-[16/9] bg-muted">
        <RemoteImage src={event.image || "/placeholder.svg"} alt="" fallbackSrc="/placeholder.svg" className="object-cover" />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge>{categoryLabel(event.category)}</Badge>
          {event.is_published === false && <Badge variant="secondary">Draft</Badge>}
        </div>
      </div>
      <CardContent className="flex-1 space-y-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link>
        </h3>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />{format(start, "EEE, d MMM yyyy")}</p>
          <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />{format(start, "h:mm a")}{event.end_date ? ` – ${format(new Date(event.end_date), "h:mm a")}` : ""}</p>
          <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{event.location}</span></p>
          <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{event.organizer}</span></p>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 p-4 pt-0">
        <Badge variant={status === "open" ? "default" : "outline"} className="font-normal">{statusLabel[status]}</Badge>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={shareEvent} aria-label={`Share ${event.title}`}><Share2 className="h-4 w-4" /></Button>
          <Button asChild size="sm"><Link href={`/events/${event.id}`}>View</Link></Button>
        </div>
      </CardFooter>
    </Card>
  )
}
