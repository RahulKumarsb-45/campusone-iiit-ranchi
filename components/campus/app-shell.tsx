"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { BrandLogo } from "@/components/campus/brand-logo"
import { NavLinks } from "@/components/campus/nav-links"
import { UserMenu } from "@/components/campus/user-menu"
import { useAuth } from "@/contexts/auth-context"
import { BRAND } from "@/lib/brand"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-2 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
            <BrandLogo />
          </div>
          <UserMenu />
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] overflow-y-auto p-4">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>{BRAND.name}</SheetTitle>
            <SheetDescription>{BRAND.collegeFull}</SheetDescription>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
            <NavLinks />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="flex-1">{children}</main>
          <footer className="border-t bg-card">
            <div className="flex flex-col gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <p>&copy; {new Date().getFullYear()} {BRAND.name} · {BRAND.collegeFull}</p>
              <nav aria-label="Footer" className="flex gap-4">
                <Link href="/help" className="hover:text-foreground hover:underline">Help &amp; Support</Link>
                <Link href="/services" className="hover:text-foreground hover:underline">Campus Services</Link>
                {!user && <Link href="/auth/login" className="hover:text-foreground hover:underline">Sign in</Link>}
              </nav>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
