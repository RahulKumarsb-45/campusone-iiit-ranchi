"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * next/image wrapper for user-supplied image URLs. The parent element must be positioned (relative) and sized.
 * On load failure it swaps to `fallbackSrc` if given, otherwise hides itself. (next.config uses
 * `images.unoptimized`, so arbitrary https hosts work without a remotePatterns allow-list.)
 */
export function RemoteImage({
  src,
  alt,
  fallbackSrc,
  className,
  sizes,
}: {
  src: string
  alt: string
  fallbackSrc?: string
  className?: string
  sizes?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const current = failedSrc === src && fallbackSrc ? fallbackSrc : src
  const hidden = failedSrc === src && !fallbackSrc
  return (
    <Image
      src={current}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
      className={cn(className, hidden && "invisible")}
      onError={() => setFailedSrc(src)}
    />
  )
}
