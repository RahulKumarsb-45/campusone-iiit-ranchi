"use client"

import { RequireAuth } from "@/components/campus/guards"
import { EventForm } from "@/components/campus/event-form"

export default function CreateEventPage() {
  return (
    <RequireAuth roles={["admin", "club_admin", "faculty"]} message="Sign in with an organizer account to create events.">
      <div className="mx-auto w-full max-w-4xl p-4 py-6 lg:p-6">
        <EventForm />
      </div>
    </RequireAuth>
  )
}
