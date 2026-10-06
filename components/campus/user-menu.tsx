"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, HelpCircle, LogIn, LogOut, Settings, ShieldCheck, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/components/ui/use-toast"
import { isAdmin, roleLabel } from "@/lib/roles"
import { safeUrl } from "@/lib/data"

export function UserMenu() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  if (loading) return <div className="h-9 w-9 animate-pulse rounded-full bg-muted" aria-hidden />

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
          <Link href="/auth/register">Sign up</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/auth/login">
            <LogIn className="mr-2 h-4 w-4" aria-hidden />
            Sign in
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Notifications">
        <Link href="/announcements">
          <Bell className="h-5 w-5" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
            <Avatar className="h-8 w-8">
              <AvatarImage src={safeUrl(user.avatar_url) ?? ""} alt="" />
              <AvatarFallback>{(user.name || user.email || "U").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1">{roleLabel[user.role] ?? user.role}</Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/profile")}><User className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
          {isAdmin(user) && (
            <DropdownMenuItem onSelect={() => router.push("/admin")}><ShieldCheck className="mr-2 h-4 w-4" />Admin Dashboard</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => router.push("/announcements")}><Bell className="mr-2 h-4 w-4" />Notifications</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/help")}><HelpCircle className="mr-2 h-4 w-4" />Help &amp; Support</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings")}><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={async () => {
              await signOut()
              toast({ title: "Signed out", description: "You have been signed out of CampusOne." })
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
