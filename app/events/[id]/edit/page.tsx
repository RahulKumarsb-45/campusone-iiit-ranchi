"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { RequireAuth } from "@/components/campus/guards"
import { EventForm } from "@/components/campus/event-form"
import { EmptyState, ErrorState } from "@/components/campus/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { fetchEventById, type EventType } from "@/lib/supabase"

function Editor() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventType | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setEvent(undefined)
    setFailed(false)
    fetchEventById(Number(id)).then((lookup) => {
      if (lookup.status === "error") setFailed(true)
      setEvent(lookup.event)
    })
  }, [id, attempt])

  if (failed) return <div className="mx-auto max-w-xl p-6"><ErrorState message="We couldn't load this event. Please try again." onRetry={() => setAttempt((n) => n + 1)} /></div>
  if (event === undefined) return <div className="mx-auto max-w-4xl p-6"><Skeleton className="h-64 w-full" /></div>
  if (!event) return <div className="mx-auto max-w-xl p-6"><EmptyState title="Event not found" /></div>
  if (user?.role !== "admin" && event.user_id !== user?.id)
    return <div className="mx-auto max-w-xl p-6"><EmptyState title="Access restricted" description="Only the organizer or an administrator can edit this event." /></div>

  return (
    <div className="mx-auto w-full max-w-4xl p-4 py-6 lg:p-6">
      <EventForm event={event} />
    </div>
  )
}

export default function EditEventPage() {
  return (
    <RequireAuth roles={["admin", "club_admin", "faculty"]}>
      <Editor />
    </RequireAuth>
  )
}
