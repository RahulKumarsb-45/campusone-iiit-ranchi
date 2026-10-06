import type React from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef, FieldDef, Row } from "@/components/campus/resource-manager"
import type { UserType } from "@/lib/supabase"
import {
  ANNOUNCEMENT_CATEGORIES, CLUB_CATEGORIES, GALLERY_CATEGORIES, LOST_FOUND_CATEGORIES, MARKET_CATEGORIES,
  OPPORTUNITY_CATEGORIES, SERVICE_CATEGORIES, WORK_MODES, categoryLabel,
} from "@/lib/constants"

const opts = (a: readonly string[]) => a.map((v) => ({ value: v, label: v }))
const published = (r: Row) => (r.is_published ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>)
const date = (v: unknown) => (typeof v === "string" && v ? format(new Date(v), "d MMM yyyy") : "—")

export type AdminModule = {
  slug: string
  title: string
  singular: string
  table: string
  fields: FieldDef[]
  columns: ColumnDef[]
  searchKeys: string[]
  defaults?: Record<string, unknown>
  extras?: (user: UserType | null) => Record<string, unknown>
  createHref?: string
  editHref?: (row: Row) => string
  canCreate?: boolean
  canDelete?: boolean
  orderBy?: string
  ascending?: boolean
}

const PRIORITIES = [{ value: "normal", label: "Normal" }, { value: "important", label: "Important" }, { value: "urgent", label: "Urgent" }]

const announcementFields = (): FieldDef[] => [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "body", label: "Description", type: "textarea", required: true },
  { name: "category", label: "Category", type: "select", options: opts(ANNOUNCEMENT_CATEGORIES) },
  { name: "priority", label: "Priority", type: "select", required: true, options: PRIORITIES },
  { name: "attachment_url", label: "Attachment link", type: "url", help: "Link to a PDF or document (optional)" },
  { name: "is_published", label: "Published", type: "checkbox" },
]
const announcementColumns: ColumnDef[] = [
  { header: "Title", render: (r) => r.title },
  { header: "Priority", render: (r) => <Badge variant={r.priority === "urgent" ? "destructive" : "secondary"} className="capitalize">{r.priority}</Badge> },
  { header: "Date", render: (r) => date(r.created_at) },
  { header: "Status", render: published },
]

export const ADMIN_MODULES: AdminModule[] = [
  {
    slug: "events", title: "Events", singular: "Event", table: "events", orderBy: "date",
    searchKeys: ["title", "organizer", "location", "category"],
    fields: [], createHref: "/events/create", editHref: (r) => `/events/${r.id}/edit`,
    columns: [
      { header: "Title", render: (r) => r.title },
      { header: "Category", render: (r) => categoryLabel(typeof r.category === "string" ? r.category : null) },
      { header: "Date", render: (r) => date(r.date) },
      { header: "Registered", render: (r) => `${r.current_participants ?? 0}${r.max_participants ? ` / ${r.max_participants}` : ""}` },
      { header: "Status", render: (r) => (r.is_published === false ? <Badge variant="outline">Draft</Badge> : <Badge>Published</Badge>) },
    ],
  },
  {
    slug: "clubs", title: "Clubs", singular: "Club", table: "clubs", searchKeys: ["name", "category"], defaults: { is_published: true },
    fields: [
      { name: "name", label: "Club name", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: opts(CLUB_CATEGORIES) },
      { name: "description", label: "Description", type: "textarea" },
      { name: "logo_url", label: "Logo link", type: "url" },
      { name: "faculty_coordinator", label: "Faculty coordinator", type: "text" },
      { name: "student_leads", label: "Student leads", type: "text" },
      { name: "contact_email", label: "Contact email", type: "text" },
      { name: "is_published", label: "Published", type: "checkbox" },
    ],
    columns: [{ header: "Name", render: (r) => r.name }, { header: "Category", render: (r) => r.category ?? "—" }, { header: "Status", render: published }],
  },
  {
    slug: "announcements", title: "Announcements", singular: "Announcement", table: "announcements", searchKeys: ["title", "category"],
    defaults: { kind: "announcement", priority: "normal", is_published: true },
    fields: announcementFields(), columns: announcementColumns,
    extras: (u) => ({ kind: "announcement", author_id: u?.id, author_name: u?.name }),
  },
  {
    slug: "notices", title: "Notices", singular: "Notice", table: "announcements", searchKeys: ["title", "category"],
    defaults: { kind: "notice", priority: "normal", is_published: true },
    fields: announcementFields(), columns: announcementColumns,
    extras: (u) => ({ kind: "notice", author_id: u?.id, author_name: u?.name }),
  },
  ...(["placement", "internship"] as const).map((kind): AdminModule => ({
    slug: kind === "placement" ? "placements" : "internships",
    title: kind === "placement" ? "Placements" : "Internships",
    singular: kind === "placement" ? "Placement" : "Internship",
    table: "opportunities", searchKeys: ["company", "role", "location"],
    defaults: { kind, status: "open", is_published: true },
    extras: () => ({ kind }),
    fields: [
      { name: "company", label: "Company", type: "text", required: true },
      { name: "role", label: "Role", type: "text", required: true },
      ...(kind === "placement" ? [{ name: "category", label: "Category", type: "select", options: opts(OPPORTUNITY_CATEGORIES) } as FieldDef] : []),
      { name: "location", label: "Location", type: "text" },
      ...(kind === "internship" ? [
        { name: "work_mode", label: "Work mode", type: "select", options: WORK_MODES } as FieldDef,
        { name: "domain", label: "Domain", type: "text" } as FieldDef,
        { name: "duration", label: "Duration", type: "text", placeholder: "e.g. 2 months" } as FieldDef,
        { name: "stipend", label: "Stipend", type: "text" } as FieldDef,
      ] : [{ name: "domain", label: "Domain", type: "text" } as FieldDef]),
      { name: "eligibility", label: "Eligibility", type: "text" },
      { name: "batch", label: "Batch", type: "text" },
      { name: "min_cgpa", label: "Minimum CGPA", type: "number" },
      { name: "skills", label: "Skills", type: "tags", help: "Comma separated" },
      { name: "deadline", label: "Application deadline", type: "datetime" },
      { name: "apply_url", label: "Application link", type: "url" },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "open", label: "Open" }, { value: "upcoming", label: "Upcoming" }, { value: "closed", label: "Closed" }] },
      { name: "is_published", label: "Published", type: "checkbox" },
    ],
    columns: [
      { header: "Company", render: (r) => r.company }, { header: "Role", render: (r) => r.role },
      { header: "Deadline", render: (r) => date(r.deadline) }, { header: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{r.status}</Badge> },
      { header: "Visible", render: published },
    ],
  })),
  {
    slug: "services", title: "Campus Services", singular: "Service", table: "campus_services", searchKeys: ["title", "category"], defaults: { is_published: true },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: opts(SERVICE_CATEGORIES) },
      { name: "description", label: "Description", type: "textarea" },
      { name: "contact", label: "Contact", type: "text", help: "Only add contact details you have verified" },
      { name: "location", label: "Location", type: "text" },
      { name: "timings", label: "Timings", type: "text" },
      { name: "important_info", label: "Important information", type: "textarea" },
      { name: "is_published", label: "Published", type: "checkbox" },
    ],
    columns: [{ header: "Title", render: (r) => r.title }, { header: "Category", render: (r) => r.category ?? "—" }, { header: "Status", render: published }],
  },
  {
    slug: "gallery", title: "Gallery", singular: "Photo", table: "gallery_items", searchKeys: ["title", "category"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "image_url", label: "Image link", type: "url", required: true },
      { name: "category", label: "Category", type: "select", options: opts(GALLERY_CATEGORIES) },
      { name: "caption", label: "Caption", type: "text" },
    ],
    columns: [{ header: "Title", render: (r) => r.title }, { header: "Category", render: (r) => r.category ?? "—" }, { header: "Added", render: (r) => date(r.created_at) }],
  },
  {
    slug: "lost-found", title: "Lost & Found", singular: "Report", table: "lost_found_items", searchKeys: ["item_name", "location", "reporter_name"], canCreate: false,
    fields: [
      { name: "item_name", label: "Item name", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: opts(LOST_FOUND_CATEGORIES) },
      { name: "status", label: "Status", type: "select", required: true, options: ["lost", "found", "claimed", "resolved"].map((v) => ({ value: v, label: v })) },
      { name: "description", label: "Description", type: "textarea" },
    ],
    columns: [{ header: "Item", render: (r) => r.item_name }, { header: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{r.status}</Badge> }, { header: "Reporter", render: (r) => r.reporter_name ?? "—" }, { header: "Reported", render: (r) => date(r.created_at) }],
  },
  {
    slug: "marketplace", title: "Marketplace", singular: "Listing", table: "marketplace_listings", searchKeys: ["title", "seller_name"], canCreate: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: opts(MARKET_CATEGORIES) },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "available", label: "Available" }, { value: "sold", label: "Sold" }, { value: "removed", label: "Removed (hidden)" }] },
      { name: "description", label: "Description", type: "textarea" },
    ],
    columns: [{ header: "Title", render: (r) => r.title }, { header: "Price", render: (r) => `₹${r.price}` }, { header: "Seller", render: (r) => r.seller_name ?? "—" }, { header: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{r.status}</Badge> }],
  },
  {
    slug: "users", title: "Users", singular: "User", table: "users", orderBy: "name", ascending: true, searchKeys: ["name", "email", "roll_number", "department"], canCreate: false, canDelete: false,
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "select", required: true, options: [{ value: "student", label: "Student" }, { value: "faculty", label: "Faculty" }, { value: "club_admin", label: "Club Admin" }, { value: "admin", label: "Admin" }, { value: "guest", label: "Guest" }], help: "Admins have full access to all management pages." },
      { name: "branch", label: "Branch", type: "text" }, { name: "batch", label: "Batch", type: "text" }, { name: "semester", label: "Semester", type: "text" },
    ],
    columns: [{ header: "Name", render: (r) => r.name }, { header: "Email", render: (r) => r.email }, { header: "Role", render: (r) => <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge> }],
  },
]
