import Link from "next/link"
import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8 shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="hsl(var(--primary))" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#fbbf24" strokeWidth="5" />
      <circle cx="32" cy="32" r="5" fill="#fff" />
    </svg>
  )
}

export function BrandLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label={`${BRAND.name} – ${BRAND.college} home`}>
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-semibold tracking-tight">{BRAND.name}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{BRAND.college}</span>
      </span>
    </Link>
  )
}
