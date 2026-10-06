import { redirect } from "next/navigation"

// The original project had a second, non-functional login page here. /auth/login is the real one.
export default function LegacyLogin() {
  redirect("/auth/login")
}
