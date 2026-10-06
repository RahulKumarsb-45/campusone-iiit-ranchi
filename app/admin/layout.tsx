"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RequireAuth } from "@/components/campus/guards"
import { cn } from "@/lib/utils"
import { ADMIN_MODULES } from "@/lib/admin-config"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <RequireAuth roles={["admin"]} message="Sign in with an administrator account to continue.">
      <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
        <nav aria-label="Admin sections" className="mb-6 overflow-x-auto">
          <ul className="flex w-max gap-1 border-b">
            {[{ slug: "", title: "Overview" }, ...ADMIN_MODULES].map((m) => {
              const href = m.slug ? `/admin/${m.slug}` : "/admin"
              const active = pathname === href
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={cn("block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{m.title}</Link>
                </li>
              )
            })}
          </ul>
        </nav>
        {children}
      </div>
    </RequireAuth>
  )
}
