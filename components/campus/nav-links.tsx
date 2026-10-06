"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAIN_NAV } from "@/lib/nav"
import { useAuth } from "@/contexts/auth-context"
import { isAdmin } from "@/lib/roles"

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const items = user ? MAIN_NAV : MAIN_NAV.filter((i) => i.href !== "/dashboard")

  const link = (href: string, label: string, Icon: LucideIcon) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    )
  }

  return (
    <nav aria-label="Main" className="grid gap-1">
      {items.map((i) => link(i.href, i.label, i.icon))}
      {isAdmin(user) && (
        <>
          <div className="mx-3 my-2 border-t" />
          {link("/admin", "Admin Dashboard", ShieldCheck)}
        </>
      )}
    </nav>
  )
}
