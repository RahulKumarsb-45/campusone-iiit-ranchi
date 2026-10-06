import type { UserType } from "@/lib/supabase"

// NOTE: these helpers only drive what the UI shows. Real enforcement is Row Level Security
// in Supabase (see supabase/campusone_migration.sql).
export const isAdmin = (u?: Pick<UserType, "role"> | null) => u?.role === "admin"
export const isClubAdmin = (u?: Pick<UserType, "role"> | null) => u?.role === "club_admin"
export const canManageEvents = (u?: Pick<UserType, "role"> | null) =>
  !!u && (u.role === "admin" || u.role === "club_admin" || u.role === "faculty")

export const roleLabel: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  guest: "Guest",
  club_admin: "Club Admin",
  admin: "Admin",
}
