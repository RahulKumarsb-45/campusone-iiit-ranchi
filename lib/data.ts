import { supabase, supabaseConfigError } from "@/lib/supabase"

export type Result<T> = { data: T; error: null } | { data: null; error: string }

/** Friendly message – never surface raw database errors to the UI. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined): string {
  if (supabaseConfigError) return "CampusOne isn't connected to its database yet. An administrator needs to set the Supabase environment variables."
  if (!error) return "Something went wrong. Please try again."
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message || ""))
    return "You don't have permission to do that."
  if (error.code === "23505") return "That entry already exists."
  if (error.code === "42P01" || error.code === "PGRST205")
    return "This section isn't set up yet. An administrator needs to run the CampusOne database migration."
  if (error.code === "23514" || error.code === "23502") return "Some fields are invalid or missing."
  return "Something went wrong. Please try again."
}

type ListOptions = {
  orderBy?: string
  ascending?: boolean
  limit?: number
  eq?: Record<string, string | number | boolean>
}

export async function listRows<T>(table: string, opts: ListOptions = {}): Promise<Result<T[]>> {
  let q = supabase.from(table).select("*")
  for (const [k, v] of Object.entries(opts.eq ?? {})) q = q.eq(k, v)
  q = q.order(opts.orderBy ?? "created_at", { ascending: opts.ascending ?? false })
  if (opts.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) {
    console.error(`[${table}] list failed`, error.code)
    return { data: null, error: friendlyError(error) }
  }
  return { data: (data ?? []) as T[], error: null }
}

export async function getRow<T>(table: string, id: number | string): Promise<Result<T | null>> {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error(`[${table}] get failed`, error.code)
    return { data: null, error: friendlyError(error) }
  }
  return { data: (data as T) ?? null, error: null }
}

export async function insertRow<T>(table: string, values: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.from(table).insert([values]).select().single()
  if (error) return { data: null, error: friendlyError(error) }
  return { data: data as T, error: null }
}

export async function updateRow(table: string, id: number | string, values: Record<string, unknown>): Promise<Result<true>> {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id")
  if (error) return { data: null, error: friendlyError(error) }
  // RLS silently filters rows the user can't touch – treat zero rows as a permission failure.
  if (!data || data.length === 0) return { data: null, error: "You don't have permission to change this item." }
  return { data: true, error: null }
}

export async function deleteRow(table: string, id: number | string): Promise<Result<true>> {
  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id")
  if (error) return { data: null, error: friendlyError(error) }
  if (!data || data.length === 0) return { data: null, error: "You don't have permission to delete this item." }
  return { data: true, error: null }
}

const countQuery = (table: string) => supabase.from(table).select("id", { count: "exact", head: true })
type CountQuery = ReturnType<typeof countQuery>

export async function countRows(table: string, filter?: (q: CountQuery) => CountQuery): Promise<number | null> {
  let q = countQuery(table)
  if (filter) q = filter(q)
  const { count, error } = await q
  return error ? null : count ?? 0
}

/** Only http(s) URLs are accepted for image / link fields. */
export function safeUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}
