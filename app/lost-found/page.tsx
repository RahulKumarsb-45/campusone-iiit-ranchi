"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { MapPin, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/campus/page-header"
import { RequireAuth } from "@/components/campus/guards"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/campus/states"
import { useRows } from "@/hooks/use-rows"
import { useAuth } from "@/contexts/auth-context"
import { deleteRow, insertRow, safeUrl, updateRow } from "@/lib/data"
import { LOST_FOUND_CATEGORIES } from "@/lib/constants"
import { isAdmin } from "@/lib/roles"
import type { LostFoundType } from "@/lib/supabase"
import { RemoteImage } from "@/components/campus/remote-image"

const STATUSES = ["lost", "found", "claimed", "resolved"] as const
const statusVariant = (s: string) => (s === "lost" ? "destructive" : s === "found" ? "default" : "secondary")
const blank = { type: "lost", item_name: "", description: "", category: "", location: "", item_date: "", image_url: "", contact_info: "" }

function LostFound() {
  const { user } = useAuth()
  const { rows, loading, error, reload } = useRows<LostFoundType>("lost_found_items")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [category, setCategory] = useState("all")
  const [reporting, setReporting] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<LostFoundType | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => category === "all" || r.category === category)
      .filter((r) => !q || [r.item_name, r.description, r.location].some((v) => (v ?? "").toLowerCase().includes(q)))
  }, [rows, query, status, category])

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!form.item_name.trim()) e.item_name = "Item name is required"
    if (!form.contact_info.trim()) e.contact_info = "Contact information is required"
    if (!form.location.trim()) e.location = "Location is required"
    if (form.image_url && !safeUrl(form.image_url)) e.image_url = "Enter a valid http(s) link"
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    const res = await insertRow("lost_found_items", {
      item_name: form.item_name.trim(), description: form.description.trim() || null, category: form.category || null,
      location: form.location.trim(), item_date: form.item_date || null, image_url: form.image_url.trim() || null,
      status: form.type, contact_info: form.contact_info.trim(), reporter_id: user!.id, reporter_name: user!.name,
    })
    setSaving(false)
    if (res.error) return toast({ title: "Could not submit report", description: res.error, variant: "destructive" })
    toast({ title: "Report submitted", description: `Your ${form.type} item has been listed.` })
    setReporting(false); setForm({ ...blank }); reload()
  }

  const canEdit = (r: LostFoundType) => r.reporter_id === user?.id || isAdmin(user)
  const changeStatus = async (r: LostFoundType, next: string) => {
    const res = await updateRow("lost_found_items", r.id, { status: next })
    if (res.error) return toast({ title: "Could not update", description: res.error, variant: "destructive" })
    setSelected({ ...r, status: next as LostFoundType["status"] }); reload()
  }
  const remove = async () => {
    if (!selected) return
    const res = await deleteRow("lost_found_items", selected.id)
    setConfirmDelete(false)
    if (res.error) return toast({ title: "Could not delete", description: res.error, variant: "destructive" })
    toast({ title: "Report deleted" }); setSelected(null); reload()
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader title="Lost & Found" description="Report a lost or found item and help it get back to its owner."
        actions={<Button onClick={() => { setForm({ ...blank }); setErrors({}); setReporting(true) }}><Plus className="mr-2 h-4 w-4" aria-hidden />Report item</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search items" placeholder="Search items or places…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{LOST_FOUND_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title="No items found" description="Lost something or found something? Use “Report item”." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
              <Card className="h-full overflow-hidden transition-colors hover:border-primary/40">
                <div className="relative aspect-[4/3] bg-muted">
                  {safeUrl(r.image_url) && <RemoteImage src={safeUrl(r.image_url)!} alt="" className="object-cover" />}
                </div>
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2"><h2 className="truncate font-medium">{r.item_name}</h2><Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge></div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{r.location}</span></p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.item_date ?? r.created_at), "d MMM yyyy")}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Report an item</DialogTitle><DialogDescription>Contact details are visible to signed-in CampusOne users.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>I…</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger aria-label="Report type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="lost">Lost an item</SelectItem><SelectItem value="found">Found an item</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1.5"><Label htmlFor="lf-name">Item name *</Label><Input id="lf-name" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />{errors.item_name && <p role="alert" className="text-xs text-destructive">{errors.item_name}</p>}</div>
            <div className="grid gap-1.5"><Label>Category</Label>
              <Select value={form.category || undefined} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger aria-label="Category"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{LOST_FOUND_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label htmlFor="lf-desc">Description</Label><Textarea id="lf-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="lf-loc">Location *</Label><Input id="lf-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />{errors.location && <p role="alert" className="text-xs text-destructive">{errors.location}</p>}</div>
              <div className="grid gap-1.5"><Label htmlFor="lf-date">Date</Label><Input id="lf-date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.item_date} onChange={(e) => setForm({ ...form, item_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="lf-img">Image link (optional)</Label><Input id="lf-img" type="url" placeholder="https://…" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />{errors.image_url && <p role="alert" className="text-xs text-destructive">{errors.image_url}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="lf-contact">Contact information *</Label><Input id="lf-contact" placeholder="Phone or email" value={form.contact_info} onChange={(e) => setForm({ ...form, contact_info: e.target.value })} />{errors.contact_info && <p role="alert" className="text-xs text-destructive">{errors.contact_info}</p>}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReporting(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit report"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (<>
            <DialogHeader><DialogTitle>{selected.item_name}</DialogTitle><DialogDescription className="capitalize">{selected.status}{selected.category ? ` · ${selected.category}` : ""}</DialogDescription></DialogHeader>
            {safeUrl(selected.image_url) && <div className="relative h-64 w-full"><RemoteImage src={safeUrl(selected.image_url)!} alt={selected.item_name} sizes="512px" className="rounded-md object-contain" /></div>}
            <div className="space-y-2 text-sm">
              {selected.description && <p className="whitespace-pre-line">{selected.description}</p>}
              <p><span className="text-muted-foreground">Location: </span>{selected.location}</p>
              <p><span className="text-muted-foreground">Date: </span>{format(new Date(selected.item_date ?? selected.created_at), "d MMM yyyy")}</p>
              <p><span className="text-muted-foreground">Contact{selected.reporter_name ? ` (${selected.reporter_name})` : ""}: </span>{selected.contact_info}</p>
            </div>
            {canEdit(selected) && (
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
                <Select value={selected.status} onValueChange={(v) => changeStatus(selected, v)}><SelectTrigger className="sm:w-40" aria-label="Update status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
              </DialogFooter>
            )}
          </>)}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this report?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  )
}

export default function LostFoundPage() {
  return <RequireAuth message="Sign in with your CampusOne account to view and report lost & found items."><LostFound /></RequireAuth>
}
