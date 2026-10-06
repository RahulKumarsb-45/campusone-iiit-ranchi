import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { readSupabaseEnv } from "@/lib/supabase-config"
import { rateLimit } from "@/lib/rate-limit"
import { sendRegistrationEmail, sendVolunteerConfirmationEmail } from "@/lib/email-service"

export const runtime = "nodejs"

/**
 * Sends a confirmation email to the *signed-in user's own address*.
 * The recipient is never taken from the request body, so this cannot be abused as a mail relay.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { type?: string; eventId?: number; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const eventId = Number(body.eventId)
  if (!Number.isInteger(eventId) || (body.type !== "registration" && body.type !== "volunteer")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const env = readSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (env.error) return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  const supabase = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: auth } = await supabase.auth.getUser(token)
  const email = auth.user?.email
  if (!auth.user || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = auth.user.id

  // Cooldown per user+event+type, plus an overall cap per user (checked after authentication).
  const cooldown = rateLimit(`notify:${userId}:${eventId}:${body.type}`, 1, 60_000)
  const overall = cooldown.ok ? rateLimit(`notify:${userId}`, 10, 10 * 60_000) : cooldown
  if (!overall.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(overall.retryAfterSeconds) } })
  }

  // The caller must actually be registered for this event (RLS limits this query to their own rows).
  const { data: reg } = await supabase
    .from("registrations")
    .select("id,is_volunteer,volunteer_role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!reg) return NextResponse.json({ error: "Not registered" }, { status: 403 })

  // A participant registration can only trigger the participant email, a volunteer one only the volunteer email.
  if ((body.type === "volunteer") !== reg.is_volunteer) return NextResponse.json({ error: "Not registered for this request" }, { status: 403 })

  // If the client names a role it must match the stored one; the email always uses the stored value.
  const suppliedRole = typeof body.role === "string" ? body.role.trim() : ""
  const storedRole = (reg.volunteer_role ?? "").trim()
  if (body.type === "volunteer" && suppliedRole && suppliedRole !== storedRole) {
    return NextResponse.json({ error: "Role does not match your registration" }, { status: 403 })
  }

  const { data: event } = await supabase.from("events").select("title,date,location,is_paid,price").eq("id", eventId).maybeSingle()
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  // Global cooldown shared by every server instance (migration 7). It is claimed only after the request is
  // fully validated, so rejected requests don't burn the user's slot. If the migration hasn't been applied yet
  // the RPC doesn't exist; then only the per-instance limiter above applies.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_notification", { p_event_id: eventId, p_type: body.type })
  if (claimError) {
    const missing = claimError.code === "PGRST202" || claimError.code === "42883"
    console.error("Notification cooldown check failed", claimError.code)
    if (!missing) return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  } else if (claimed === false) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": "60" } })
  }

  const result =
    body.type === "volunteer"
      ? await sendVolunteerConfirmationEmail(email, event.title, event.date, (storedRole || "Volunteer").slice(0, 80))
      : await sendRegistrationEmail(email, event.title, event.date, event.location)

  // Email is best-effort: registration already succeeded, so don't fail the request if SMTP isn't configured.
  return NextResponse.json({ sent: result.success })
}
