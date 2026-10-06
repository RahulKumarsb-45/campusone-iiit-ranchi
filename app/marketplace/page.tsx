"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
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
import { MARKET_CATEGORIES } from "@/lib/constants"
import { isAdmin } from "@/lib/roles"
import type { ListingType } from "@/lib/supabase"
import { RemoteImage } from "@/components/campus/remote-image"

const blank = { title: "", description: "", price: "", category: "", image_url: "", contact_method: "" }
const rupees = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

function Marketplace() {
  const { user } = useAuth()
  const { rows, loading, error, reload } = useRows<ListingType>("marketplace_listings")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<ListingType | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => (mine ? r.seller_id === user?.id : r.status !== "removed"))
      .filter((r) => category === "all" || r.category === category)
      .filter((r) => !q || [r.title, r.description].some((v) => (v ?? "").toLowerCase().includes(q)))
  }, [rows, query, category, mine, user])

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = "Title is required"
    if (form.price === "" || Number.isNaN(Number(form.price)) || Number(form.price) < 0) e.price = "Enter a valid price"
    if (!form.contact_method.trim()) e.contact_method = "Tell buyers how to reach you"
    if (form.image_url && !safeUrl(form.image_url)) e.image_url = "Enter a valid http(s) link"
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    const res = await insertRow("marketplace_listings", {
      title: form.title.trim(), description: form.description.trim() || null, price: Number(form.price), category: form.category || null,
      image_url: form.image_url.trim() || null, contact_method: form.contact_method.trim(), seller_id: user!.id, seller_name: user!.name,
    })
    setSaving(false)
    if (res.error) return toast({ title: "Could not create listing", description: res.error, variant: "destructive" })
    toast({ title: "Listing published" }); setCreating(false); setForm({ ...blank }); reload()
  }

  const canEdit = (r: ListingType) => r.seller_id === user?.id || isAdmin(user)
  const setStatus = async (r: ListingType, status: string) => {
    const res = await updateRow("marketplace_listings", r.id, { status })
    if (res.error) return toast({ title: "Could not update", description: res.error, variant: "destructive" })
    setSelected({ ...r, status: status as ListingType["status"] }); reload()
  }
  const remove = async () => {
    if (!selected) return
    const res = await deleteRow("marketplace_listings", selected.id)
    setConfirmDelete(false)
    if (res.error) return toast({ title: "Could not delete", description: res.error, variant: "destructive" })
    toast({ title: "Listing deleted" }); setSelected(null); reload()
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 py-6 lg:p-6">
      <PageHeader title="Marketplace" description="Buy and sell books, electronics, cycles and more within the campus community."
        actions={<Button onClick={() => { setForm({ ...blank }); setErrors({}); setCreating(true) }}><Plus className="mr-2 h-4 w-4" aria-hidden />New listing</Button>} />
      <p className="mb-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">CampusOne does not process payments. Arrange meetups in public campus areas and inspect items before paying.</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input type="search" aria-label="Search listings" placeholder="Search listings…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{MARKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Button variant={mine ? "secondary" : "outline"} aria-pressed={mine} onClick={() => setMine(!mine)}>My listings</Button>
      </div>

      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState title={mine ? "You have no listings" : "No listings found"} description="Be the first to list something for your fellow students." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full overflow-hidden transition-colors hover:border-primary/40">
                <div className="relative aspect-[4/3] bg-muted">{safeUrl(r.image_url) && <RemoteImage src={safeUrl(r.image_url)!} alt="" className="object-cover" />}</div>
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-start justify-between gap-2"><h2 className="line-clamp-1 font-medium">{r.title}</h2>{r.status !== "available" && <Badge variant="secondary" className="capitalize">{r.status}</Badge>}</div>
                  <p className="text-lg font-semibold">{rupees(r.price)}</p>
                  {r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>New listing</DialogTitle><DialogDescription>Only list items you own and are allowed to sell on campus.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="mk-title">Title *</Label><Input id="mk-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />{errors.title && <p role="alert" className="text-xs text-destructive">{errors.title}</p>}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="mk-price">Price (₹) *</Label><Input id="mk-price" type="number" min="0" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />{errors.price && <p role="alert" className="text-xs text-destructive">{errors.price}</p>}</div>
              <div className="grid gap-1.5"><Label>Category</Label><Select value={form.category || undefined} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger aria-label="Category"><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{MARKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="mk-desc">Description</Label><Textarea id="mk-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="mk-img">Image link (optional)</Label><Input id="mk-img" type="url" placeholder="https://…" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />{errors.image_url && <p role="alert" className="text-xs text-destructive">{errors.image_url}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="mk-contact">How should buyers contact you? *</Label><Input id="mk-contact" placeholder="Phone, WhatsApp or email" value={form.contact_method} onChange={(e) => setForm({ ...form, contact_method: e.target.value })} />{errors.contact_method && <p role="alert" className="text-xs text-destructive">{errors.contact_method}</p>}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Publishing…" : "Publish"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (<>
            <DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{rupees(selected.price)}{selected.category ? ` · ${selected.category}` : ""} · <span className="capitalize">{selected.status}</span></DialogDescription></DialogHeader>
            {safeUrl(selected.image_url) && <div className="relative h-64 w-full"><RemoteImage src={safeUrl(selected.image_url)!} alt={selected.title} sizes="512px" className="rounded-md object-contain" /></div>}
            <div className="space-y-2 text-sm">
              {selected.description && <p className="whitespace-pre-line">{selected.description}</p>}
              <p><span className="text-muted-foreground">Seller{selected.seller_name ? ` (${selected.seller_name})` : ""}: </span>{selected.contact_method}</p>
            </div>
            {canEdit(selected) && (
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
                <Button variant="outline" onClick={() => setStatus(selected, selected.status === "sold" ? "available" : "sold")}>{selected.status === "sold" ? "Mark available" : "Mark as sold"}</Button>
              </DialogFooter>
            )}
          </>)}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this listing?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  )
}

export default function MarketplacePage() {
  return <RequireAuth message="Sign in with your CampusOne account to browse and post listings."><Marketplace /></RequireAuth>
}
