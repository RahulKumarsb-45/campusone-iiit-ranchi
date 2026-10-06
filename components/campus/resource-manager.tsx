"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { useRows } from "@/hooks/use-rows"
import { deleteRow, insertRow, safeUrl, updateRow } from "@/lib/data"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/campus/states"
import { useAuth } from "@/contexts/auth-context"
import type { UserType } from "@/lib/supabase"

export type FieldDef = {
  name: string
  label: string
  type: "text" | "textarea" | "select" | "number" | "date" | "datetime" | "url" | "tags" | "checkbox"
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  help?: string
}

type Cell = string | number | boolean | null | undefined
/** A table row as returned by Supabase (every table has an id). */
export type Row = { id: number | string } & Record<string, Cell>
type FormValue = string | number | boolean

export type ColumnDef = { header: string; render: (row: Row) => React.ReactNode }

type Props = {
  table: string
  singular: string
  fields: FieldDef[]
  columns: ColumnDef[]
  searchKeys: string[]
  defaults?: Record<string, unknown>
  /** Extra values injected on create (e.g. author_id). */
  onCreateExtras?: (user: UserType | null) => Record<string, unknown>
  pageSize?: number
  /** Full-page editors (e.g. events) instead of the dialog. */
  createHref?: string
  editHref?: (row: Row) => string
  canCreate?: boolean
  canDelete?: boolean
  /** Equality filter applied to the list (e.g. { kind: "notice" }). */
  filter?: Record<string, string | number | boolean>
  orderBy?: string
  ascending?: boolean
}

const toInput = (f: FieldDef, v: unknown): FormValue => {
  if (v == null) return f.type === "checkbox" ? false : ""
  if (f.type === "datetime") return new Date(String(v)).toISOString().slice(0, 16)
  if (f.type === "date") return String(v).slice(0, 10)
  if (f.type === "tags") return Array.isArray(v) ? v.join(", ") : String(v)
  return typeof v === "number" || typeof v === "boolean" ? v : String(v)
}

export function ResourceManager({ table, singular, fields, columns, searchKeys, defaults = {}, onCreateExtras, pageSize = 10, createHref, editHref, canCreate = true, canDelete = true, filter, orderBy, ascending }: Props) {
  const { user } = useAuth()
  const { rows, loading, error, reload } = useRows<Row>(table, { eq: filter, orderBy, ascending })
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, FormValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Row | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)))
  }, [rows, query, searchKeys])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)

  const openCreate = () => {
    const init: Record<string, FormValue> = {}
    fields.forEach((f) => (init[f.name] = toInput(f, defaults[f.name])))
    setForm(init)
    setErrors({})
    setEditing(null)
    setCreating(true)
  }
  const openEdit = (row: Row) => {
    const init: Record<string, FormValue> = {}
    fields.forEach((f) => (init[f.name] = toInput(f, row[f.name])))
    setForm(init)
    setErrors({})
    setEditing(row)
    setCreating(true)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    for (const f of fields) {
      const v = form[f.name]
      if (f.required && f.type !== "checkbox" && (v === "" || v == null)) e[f.name] = `${f.label} is required`
      if (f.type === "url" && typeof v === "string" && v !== "" && !safeUrl(v)) e[f.name] = "Enter a valid http(s) link"
      if (f.type === "number" && v !== "" && v != null && Number.isNaN(Number(v))) e[f.name] = "Enter a number"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildPayload = () => {
    const out: Record<string, unknown> = {}
    for (const f of fields) {
      const v = form[f.name]
      if (f.type === "checkbox") out[f.name] = !!v
      else if (f.type === "number") out[f.name] = v === "" || v == null ? null : Number(v)
      else if (f.type === "datetime") out[f.name] = v ? new Date(String(v)).toISOString() : null
      else if (f.type === "tags") out[f.name] = String(v || "").split(",").map((s) => s.trim()).filter(Boolean)
      else out[f.name] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v
    }
    return out
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    const payload = buildPayload()
    const res = editing
      ? await updateRow(table, editing.id, payload)
      : await insertRow(table, { ...payload, ...(onCreateExtras?.(user) ?? {}) })
    setSaving(false)
    if (res.error) {
      toast({ title: `Could not save ${singular}`, description: res.error, variant: "destructive" })
      return
    }
    toast({ title: `${singular} ${editing ? "updated" : "created"}` })
    setCreating(false)
    reload()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const res = await deleteRow(table, toDelete.id)
    setToDelete(null)
    if (res.error) toast({ title: `Could not delete ${singular}`, description: res.error, variant: "destructive" })
    else {
      toast({ title: `${singular} deleted` })
      reload()
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label={`Search ${singular}`}
            placeholder={`Search ${singular.toLowerCase()}s…`}
            className="pl-8"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </div>
        {canCreate && (createHref ? (
          <Button asChild><Link href={createHref}><Plus className="mr-2 h-4 w-4" aria-hidden />Add {singular.toLowerCase()}</Link></Button>
        ) : (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" aria-hidden />Add {singular.toLowerCase()}</Button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={`No ${singular.toLowerCase()}s found`} description={query ? "Try a different search." : canCreate ? `Add the first ${singular.toLowerCase()} to get started.` : undefined} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => <TableHead key={c.header}>{c.header}</TableHead>)}
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c) => <TableCell key={c.header} className="max-w-[16rem] truncate">{c.render(row)}</TableCell>)}
                    <TableCell className="text-right">
                      {editHref ? (
                        <Button asChild variant="ghost" size="icon" aria-label={`Edit ${singular}`}><Link href={editHref(row)}><Pencil className="h-4 w-4" /></Link></Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${singular}`}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {canDelete && <Button variant="ghost" size="icon" onClick={() => setToDelete(row)} aria-label={`Delete ${singular}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} total</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
              <span>Page {current} of {pages}</span>
              <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {fields.map((f) => (
              <div key={f.name} className="grid gap-1.5">
                {f.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox id={`f-${f.name}`} checked={!!form[f.name]} onCheckedChange={(c) => setForm({ ...form, [f.name]: c === true })} />
                    <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
                  </div>
                ) : (
                  <>
                    <Label htmlFor={`f-${f.name}`}>{f.label}{f.required && " *"}</Label>
                    {f.type === "textarea" ? (
                      <Textarea id={`f-${f.name}`} rows={4} value={String(form[f.name] ?? "")} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                    ) : f.type === "select" ? (
                      <Select value={String(form[f.name] || "") || undefined} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                        <SelectTrigger id={`f-${f.name}`}><SelectValue placeholder={f.placeholder ?? "Select…"} /></SelectTrigger>
                        <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`f-${f.name}`}
                        type={f.type === "datetime" ? "datetime-local" : f.type === "tags" ? "text" : f.type === "url" ? "url" : f.type}
                        step={f.type === "number" ? "any" : undefined}
                        value={String(form[f.name] ?? "")}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      />
                    )}
                  </>
                )}
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                {errors[f.name] && <p role="alert" className="text-xs text-destructive">{errors[f.name]}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const publishedBadge = (row: Row) =>
  row.is_published ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>
