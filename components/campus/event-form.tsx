"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Clock, MapPin, Plus, Upload, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createEvent, updateEvent, type EventType } from "@/lib/supabase"
import { EVENT_CATEGORIES } from "@/lib/constants"
import { safeUrl } from "@/lib/data"

export function EventForm({ event }: { event?: EventType }) {
  const editing = !!event
  const router = useRouter()
  const { user } = useAuth()
  const [isPaid, setIsPaid] = useState(event?.is_paid ?? false)
  const [needsVolunteers, setNeedsVolunteers] = useState(event?.needs_volunteers ?? false)
  const [isPublished, setIsPublished] = useState(event?.is_published ?? false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pad = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
  const start = event ? pad(new Date(event.date)) : ""
  const [eventForm, setEventForm] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "",
    otherCategoryDetails: event?.other_category_details ?? "",
    date: start.slice(0, 10),
    time: start.slice(11, 16),
    endTime: event?.end_date ? pad(new Date(event.end_date)).slice(11, 16) : "",
    registrationDeadline: event?.registration_deadline ? pad(new Date(event.registration_deadline)).slice(0, 16) : "",
    location: event?.location ?? "",
    organizer: event?.organizer ?? "",
    leadOrganizer: event?.lead_organizer ?? "",
    convener: event?.convener ?? "",
    coordinator: event?.coordinator ?? "",
    contactNumber: event?.contact_number ?? "",
    registrationLink: event?.registration_link ?? "",
    price: event?.price ?? 0,
    tags: (event?.tags ?? []) as string[],
    maxParticipants: event?.max_participants ?? 100,
    image: event?.image ?? "",
    volunteerRoles: event?.volunteer_roles?.length ? event.volunteer_roles : [""],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validate form
    if (!eventForm.title || !eventForm.description || !eventForm.category || !eventForm.date || !eventForm.time) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    // Validate "other" category
    if (eventForm.category === "other" && !eventForm.otherCategoryDetails) {
      toast({
        title: "Missing category details",
        description: "Please provide details for the 'Other' category.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Format date and time
      const dateTime = new Date(`${eventForm.date}T${eventForm.time}`)

      if (eventForm.image && !safeUrl(eventForm.image)) {
        toast({ title: "Invalid image link", description: "Image must be an http(s) URL.", variant: "destructive" })
        setIsSubmitting(false)
        return
      }
      if (eventForm.registrationLink && !safeUrl(eventForm.registrationLink)) {
        toast({ title: "Invalid registration link", description: "Enter a valid http(s) link.", variant: "destructive" })
        setIsSubmitting(false)
        return
      }
      const endDate = eventForm.endTime ? new Date(`${eventForm.date}T${eventForm.endTime}`) : null
      if (endDate && endDate <= dateTime) {
        toast({ title: "Invalid time range", description: "End time must be after the start time.", variant: "destructive" })
        setIsSubmitting(false)
        return
      }

      const values = {
        title: eventForm.title.trim(),
        description: eventForm.description,
        image: eventForm.image || "/placeholder.svg?height=300&width=500",
        date: dateTime.toISOString(),
        end_date: endDate ? endDate.toISOString() : undefined,
        registration_deadline: eventForm.registrationDeadline ? new Date(eventForm.registrationDeadline).toISOString() : null,
        ...(user?.role === "admin" ? { is_published: isPublished } : {}),
        location: eventForm.location,
        category: eventForm.category,
        other_category_details: eventForm.otherCategoryDetails,
        tags: eventForm.tags,
        organizer: eventForm.organizer,
        lead_organizer: eventForm.leadOrganizer,
        convener: eventForm.convener,
        coordinator: eventForm.coordinator,
        contact_number: eventForm.contactNumber,
        registration_link: eventForm.registrationLink,
        is_paid: isPaid,
        price: isPaid ? eventForm.price : undefined,
        max_participants: eventForm.maxParticipants,
        needs_volunteers: needsVolunteers,
        volunteer_roles: needsVolunteers ? eventForm.volunteerRoles.filter((role) => role.trim() !== "") : undefined,
      }

      const saved = editing
        ? await updateEvent(event!.id, values)
        : await createEvent({ ...values, user_id: user?.id ?? "" })

      if (saved.error !== null) {
        throw new Error(saved.error)
      }
      const newEvent = saved.data

      toast({
        title: editing ? "Event updated" : "Event created",
        description: editing ? "Your changes have been saved." : "Your event has been created.",
      })

      router.push(`/events/${newEvent.id}`)
    } catch (error) {
      console.error("Error saving event")
      toast({
        title: editing ? "Could not update event" : "Could not create event",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addVolunteerRole = () => {
    setEventForm({
      ...eventForm,
      volunteerRoles: [...eventForm.volunteerRoles, ""],
    })
  }

  const updateVolunteerRole = (index: number, value: string) => {
    const updatedRoles = [...eventForm.volunteerRoles]
    updatedRoles[index] = value
    setEventForm({
      ...eventForm,
      volunteerRoles: updatedRoles,
    })
  }

  const removeVolunteerRole = (index: number) => {
    const updatedRoles = [...eventForm.volunteerRoles]
    updatedRoles.splice(index, 1)
    setEventForm({
      ...eventForm,
      volunteerRoles: updatedRoles,
    })
  }

  return (
    <div className="container mx-auto p-4 py-6">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/events">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editing ? "Edit Event" : "Create New Event"}</h1>
            <p className="text-muted-foreground">{editing ? "Update the event details" : "Fill in the details to create a new event"}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Provide the basic details about your event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Event Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter event title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={eventForm.category}
                  onValueChange={(value) => setEventForm({ ...eventForm, category: value })}
                  required
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {eventForm.category === "other" && (
              <div className="space-y-2">
                <Label htmlFor="otherCategoryDetails">
                  Explain the details of the event <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="otherCategoryDetails"
                  placeholder="Please provide details about your event category"
                  className="min-h-[100px]"
                  value={eventForm.otherCategoryDetails}
                  onChange={(e) => setEventForm({ ...eventForm, otherCategoryDetails: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your event"
                className="min-h-[120px]"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">
                  Date <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">
                  Time <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="time"
                    type="time"
                    className="pl-9"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="Event location"
                  className="pl-9"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Maximum Participants</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="maxParticipants"
                    type="number"
                    placeholder="100"
                    className="pl-9"
                    value={eventForm.maxParticipants}
                    onChange={(e) => setEventForm({ ...eventForm, maxParticipants: Number.parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. technology, networking, career"
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      tags: e.target.value.split(",").map((tag) => tag.trim()),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch id="paid-event" checked={isPaid} onCheckedChange={setIsPaid} />
                <Label htmlFor="paid-event">This is a paid event</Label>
              </div>
            </div>

            {isPaid && (
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  value={eventForm.price}
                  onChange={(e) => setEventForm({ ...eventForm, price: Number.parseFloat(e.target.value) })}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch id="needs-volunteers" checked={needsVolunteers} onCheckedChange={setNeedsVolunteers} />
                <Label htmlFor="needs-volunteers">This event needs volunteers</Label>
              </div>
            </div>

            {needsVolunteers && (
              <div className="space-y-4">
                <Label>Volunteer Roles</Label>
                {eventForm.volunteerRoles.map((role, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={`Role ${index + 1} (e.g. Registration Desk)`}
                      value={role}
                      onChange={(e) => updateVolunteerRole(index, e.target.value)}
                    />
                    {eventForm.volunteerRoles.length > 1 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removeVolunteerRole(index)}>
                        <span className="sr-only">Remove</span>
                        <span>×</span>
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addVolunteerRole}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Role
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="image">Event Image</Label>
              <div className="flex h-32 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-gray-300 hover:border-gray-400">
                <div className="flex flex-col items-center space-y-2 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Click to upload</span> or drag and drop
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizer Information</CardTitle>
            <CardDescription>Provide details about the event organizers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizer">
                Organizing Department/Club <span className="text-red-500">*</span>
              </Label>
              <Input
                id="organizer"
                placeholder="e.g. Computer Science Department"
                value={eventForm.organizer}
                onChange={(e) => setEventForm({ ...eventForm, organizer: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadOrganizer">
                  Lead Organizer <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="leadOrganizer"
                  placeholder="Name of lead organizer"
                  value={eventForm.leadOrganizer}
                  onChange={(e) => setEventForm({ ...eventForm, leadOrganizer: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="convener">
                  Convener <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="convener"
                  placeholder="Name of convener"
                  value={eventForm.convener}
                  onChange={(e) => setEventForm({ ...eventForm, convener: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coordinator">
                  Coordinator <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="coordinator"
                  placeholder="Name of coordinator"
                  value={eventForm.coordinator}
                  onChange={(e) => setEventForm({ ...eventForm, coordinator: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactNumber"
                  placeholder="Contact phone number"
                  value={eventForm.contactNumber}
                  onChange={(e) => setEventForm({ ...eventForm, contactNumber: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationLink">External Registration Link (optional)</Label>
              <Input
                id="registrationLink"
                placeholder="https://example.com/register"
                value={eventForm.registrationLink}
                onChange={(e) => setEventForm({ ...eventForm, registrationLink: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If you have an external registration form, provide the link here. Otherwise, the built-in registration
                system will be used.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule, Registration &amp; Visibility</CardTitle>
            <CardDescription>End time, registration cut-off, image and publishing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" type="time" value={eventForm.endTime} onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationDeadline">Registration deadline</Label>
                <Input id="registrationDeadline" type="datetime-local" value={eventForm.registrationDeadline} onChange={(e) => setEventForm({ ...eventForm, registrationDeadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Event image link</Label>
              <Input id="image" type="url" placeholder="https://…" value={eventForm.image} onChange={(e) => setEventForm({ ...eventForm, image: e.target.value })} />
            </div>
            {user?.role === "admin" ? (
              <div className="flex items-center space-x-2">
                <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
                <Label htmlFor="published">Published (visible to students)</Label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {event?.is_published === false || !event
                  ? "New events are reviewed by an admin before they become visible to students."
                  : "This event is published. Edits stay live."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : editing ? "Save Changes" : "Create Event"}
          </Button>
        </div>
      </form>
    </div>
  )
}
