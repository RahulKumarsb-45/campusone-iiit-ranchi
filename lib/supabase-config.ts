export type SupabaseEnv = { url: string; anonKey: string; error: string | null }

// A host that can never resolve, used only when the environment is missing/invalid so that
// importing the client never crashes a build; every request then fails with a clear error state.
const UNCONFIGURED_URL = "https://unconfigured.invalid"
const API_SUFFIX = /^\/(rest|auth|storage|realtime)\/v1(\/.*)?$/

/**
 * Validates NEXT_PUBLIC_SUPABASE_URL. It must be the project root (https://<ref>.supabase.co);
 * the Supabase client appends /rest/v1, /auth/v1 ... itself. A trailing slash or an accidental
 * API suffix is stripped; anything else is rejected.
 */
export function readSupabaseEnv(rawUrl: string | undefined, rawKey: string | undefined): SupabaseEnv {
  const fail = (error: string): SupabaseEnv => ({ url: UNCONFIGURED_URL, anonKey: "unconfigured", error })
  const key = (rawKey ?? "").trim()
  const raw = (rawUrl ?? "").trim()
  if (!raw) return fail("NEXT_PUBLIC_SUPABASE_URL is not set.")
  if (!key) return fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.")

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.")
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return fail("NEXT_PUBLIC_SUPABASE_URL must start with https://.")
  }
  const path = parsed.pathname.replace(/\/+$/, "")
  if (path !== "" && !API_SUFFIX.test(path)) {
    return fail("NEXT_PUBLIC_SUPABASE_URL must be the project root, e.g. https://<project-ref>.supabase.co")
  }
  return { url: parsed.origin, anonKey: key, error: null }
}
