import { createClient } from "@supabase/supabase-js"
import { readSupabaseEnv } from "@/lib/supabase-config"

// Initialize Supabase client (URL is validated; see lib/supabase-config.ts)
const env = readSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/** Non-null when the Supabase environment variables are missing or malformed. */
export const supabaseConfigError = env.error
if (env.error && typeof window !== "undefined") console.error(`Supabase is not configured: ${env.error}`)

export const supabase = createClient(env.url, env.anonKey)

// Types for our database tables
export type EventType = {
  id: number
  title: string
  description: string
  long_description?: string
  image: string
  date: string
  end_date?: string
  location: string
  address?: string
  category: string
  other_category_details?: string
  tags: string[]
  organizer: string
  lead_organizer: string
  convener: string
  coordinator: string
  contact_number: string
  registration_link?: string
  is_paid: boolean
  price?: number
  max_participants: number
  current_participants: number
  created_at: string
  user_id: string
  needs_volunteers: boolean
  volunteer_roles?: string[]
  registration_deadline?: string | null
  is_published?: boolean
  club_id?: number | null
}

export type UserType = {
  id: string
  email: string
  name: string
  role: "student" | "faculty" | "guest" | "club_admin" | "admin"
  department?: string
  branch?: string
  batch?: string
  semester?: string
  year?: string
  roll_number?: string
  position?: string
  phone?: string
  address?: string
  bio?: string
  avatar_url?: string
}

export type RegistrationType = {
  id: number
  event_id: number
  user_id: string
  registration_date: string
  payment_status?: "pending" | "completed"
  payment_id?: string
  is_volunteer: boolean
  volunteer_role?: string
}

// Helper functions for database operations

/** Safe, user-facing text for a failed write. Never includes raw database messages. */
function writeErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? ""))
    return "You don't have permission to do that."
  if (error.code === "23514" || error.code === "23502" || error.code === "22P02") return "Some fields are invalid or missing."
  return "Something went wrong. Please try again."
}

/** Returns the events, or null when the database request failed (an empty array means "no events"). */
export async function fetchEvents(options?: {
  category?: string
  limit?: number
  orderBy?: string
  upcoming?: boolean
}): Promise<EventType[] | null> {
  let query = supabase.from("events").select("*")

  if (options?.category) {
    query = query.eq("category", options.category)
  }

  if (options?.upcoming) {
    query = query.gte("date", new Date().toISOString())
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching events:", error.code)
    return null
  }

  return data as EventType[]
}

/** "not_found" = the query worked but no visible row exists; "error" = the request itself failed. */
export type EventLookup =
  | { status: "found"; event: EventType }
  | { status: "not_found"; event: null }
  | { status: "error"; event: null }

export async function fetchEventById(id: number): Promise<EventLookup> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle()

  if (error) {
    console.error("Error fetching event:", error.code)
    return { status: "error", event: null }
  }
  return data ? { status: "found", event: data as EventType } : { status: "not_found", event: null }
}

export type SaveResult = { data: EventType; error: null } | { data: null; error: string }

export async function createEvent(event: Omit<EventType, "id" | "created_at" | "current_participants">): Promise<SaveResult> {
  // user_id must equal the signed-in user (enforced by RLS); counters are reset by the database.
  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        ...event,
        current_participants: 0,
        created_at: new Date().toISOString(),
      },
    ])
    .select()

  if (error) {
    console.error("Error creating event:", error.code)
    return { data: null, error: writeErrorMessage(error) }
  }
  if (!data || data.length === 0) return { data: null, error: "The event was saved but could not be read back. Please refresh." }
  return { data: data[0] as EventType, error: null }
}

const REGISTRATION_ERRORS: Record<string, string> = {
  EVENT_FULL: "This event is full.",
  REGISTRATION_CLOSED: "Registration for this event has closed.",
  EVENT_ENDED: "This event has already ended.",
  EVENT_NOT_FOUND: "This event is no longer available.",
  NOT_ACCEPTING_VOLUNTEERS: "This event isn't looking for volunteers.",
  NOT_AUTHENTICATED: "Please sign in to register.",
  INVALID_VOLUNTEER_ROLE: "Please choose one of the volunteer roles offered for this event.",
}

// Capacity, duplicate and counter handling are enforced atomically in Postgres
// (register_for_event + triggers), so concurrent sign-ups can't oversell an event.
// The user is always the signed-in Supabase user (auth.uid() inside the RPC); no user id is accepted from callers.
export async function registerForEvent(eventId: number, isVolunteer = false, volunteerRole?: string) {
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
    p_is_volunteer: isVolunteer,
    p_volunteer_role: volunteerRole ?? null,
  })

  if (error) {
    if (error.code === "23505") return { error: "Already registered" }
    const known = Object.keys(REGISTRATION_ERRORS).find((k) => error.message?.includes(k))
    console.error("Error registering for event:", error.code)
    return { error: known ? REGISTRATION_ERRORS[known] : "We couldn't complete your registration. Please try again." }
  }

  return { data: { id: data as number } }
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase.from("users").select("*").eq("id", user.id).single()

  return data
}

export type ClubType = {
  id: number
  name: string
  slug?: string | null
  category?: string | null
  description?: string | null
  logo_url?: string | null
  faculty_coordinator?: string | null
  student_leads?: string | null
  contact_email?: string | null
  lead_user_id?: string | null
  is_published: boolean
  created_at: string
}

export type AnnouncementType = {
  id: number
  kind: "announcement" | "notice"
  title: string
  body: string
  category?: string | null
  priority: "normal" | "important" | "urgent"
  attachment_url?: string | null
  author_name?: string | null
  is_published: boolean
  created_at: string
}

export type OpportunityType = {
  id: number
  kind: "placement" | "internship"
  company: string
  role: string
  category?: string | null
  location?: string | null
  work_mode?: string | null
  domain?: string | null
  duration?: string | null
  stipend?: string | null
  eligibility?: string | null
  batch?: string | null
  min_cgpa?: number | null
  skills: string[]
  deadline?: string | null
  apply_url?: string | null
  status: "open" | "closed" | "upcoming"
  is_published: boolean
  created_at: string
}

export type ServiceType = {
  id: number
  title: string
  category?: string | null
  description?: string | null
  contact?: string | null
  location?: string | null
  timings?: string | null
  important_info?: string | null
  is_published: boolean
}

export type LostFoundType = {
  id: number
  item_name: string
  description?: string | null
  category?: string | null
  location?: string | null
  item_date?: string | null
  image_url?: string | null
  status: "lost" | "found" | "claimed" | "resolved"
  contact_info: string
  reporter_id: string
  reporter_name?: string | null
  created_at: string
}

export type ListingType = {
  id: number
  title: string
  description?: string | null
  price: number
  category?: string | null
  image_url?: string | null
  contact_method: string
  status: "available" | "sold" | "removed"
  seller_id: string
  seller_name?: string | null
  created_at: string
}

export type GalleryType = {
  id: number
  title: string
  image_url: string
  category?: string | null
  caption?: string | null
  club_id?: number | null
  created_at: string
}

export async function updateEvent(id: number, values: Partial<EventType>): Promise<SaveResult> {
  const { data, error } = await supabase.from("events").update(values).eq("id", id).select()
  if (error) {
    console.error("Error updating event:", error.code)
    return { data: null, error: writeErrorMessage(error) }
  }
  if (!data || data.length === 0) return { data: null, error: "You don't have permission to change this event, or it no longer exists." }
  return { data: data[0] as EventType, error: null }
}
