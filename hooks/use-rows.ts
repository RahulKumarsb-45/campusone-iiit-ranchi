"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { listRows } from "@/lib/data"

/** Loads a table once on mount with loading / error state and a manual refetch. */
export function useRows<T>(table: string, opts?: Parameters<typeof listRows>[1]) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(opts ?? {})
  // Latest options live in a ref so `key` (their serialised form) is the only trigger for reloading.
  const optsRef = useRef(opts)
  optsRef.current = opts

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listRows<T>(table, optsRef.current)
    if (res.data === null) setError(res.error)
    else {
      setError(null)
      setRows(res.data)
    }
    setLoading(false)
  }, [table])

  // `key` is the serialised options: reload whenever the table or the options change.
  useEffect(() => {
    load()
  }, [load, key])

  return { rows, loading, error, reload: load }
}
