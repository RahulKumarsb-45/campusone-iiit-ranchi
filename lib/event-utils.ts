import type { EventType } from "@/lib/supabase"

export type EventStatus = "open" | "full" | "closed" | "ongoing" | "past"

export function getEventStatus(e: EventType, now = new Date()): EventStatus {
  const start = new Date(e.date)
  const end = e.end_date ? new Date(e.end_date) : null
  if (end ? now > end : now > new Date(start.getTime() + 6 * 3600_000)) return "past"
  if (now >= start) return "ongoing"
  if (e.registration_deadline && now > new Date(e.registration_deadline)) return "closed"
  if (e.max_participants > 0 && (e.current_participants ?? 0) >= e.max_participants) return "full"
  return "open"
}

export const statusLabel: Record<EventStatus, string> = {
  open: "Registration open",
  full: "Full",
  closed: "Registration closed",
  ongoing: "Happening now",
  past: "Completed",
}

export const isVisible = (e: EventType) => e.is_published !== false
