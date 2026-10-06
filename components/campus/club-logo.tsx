import { safeUrl } from "@/lib/data"
import { RemoteImage } from "@/components/campus/remote-image"
import type { ClubType } from "@/lib/supabase"

export function ClubLogo({ club, size = 48 }: { club: Pick<ClubType, "name" | "logo_url">; size?: number }) {
  const src = safeUrl(club.logo_url)
  return src ? (
    <div className="relative shrink-0 overflow-hidden rounded-md bg-muted" style={{ width: size, height: size }}>
      <RemoteImage src={src} alt="" sizes={`${size}px`} className="object-cover" />
    </div>
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ width: size, height: size }} aria-hidden>
      {club.name.charAt(0).toUpperCase()}
    </div>
  )
}
