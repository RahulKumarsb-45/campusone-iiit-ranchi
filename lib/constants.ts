// Stored values keep the original project's lowercase/plural convention ("workshops", "seminars")
// so existing events keep working.
export const EVENT_CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "workshops", label: "Workshop" },
  { value: "seminars", label: "Seminar" },
  { value: "hackathon", label: "Hackathon" },
  { value: "competition", label: "Competition" },
  { value: "club", label: "Club" },
  { value: "academic", label: "Academic" },
  { value: "other", label: "Other" },
] as const

export const categoryLabel = (v?: string | null) =>
  EVENT_CATEGORIES.find((c) => c.value === v)?.label ?? (v ? v.charAt(0).toUpperCase() + v.slice(1) : "Event")

export const CLUB_CATEGORIES = ["Technical", "Cultural", "Arts", "Sports", "Literary", "Entrepreneurship", "Other"]
export const OPPORTUNITY_CATEGORIES = ["Internship", "Full Time", "Internship + PPO", "Placement Drive"]
export const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
]
export const SERVICE_CATEGORIES = ["Hostel", "Mess", "Library", "Medical", "Transport", "Wi-Fi / Internet", "Computer Lab", "Sports", "Security", "Emergency", "Other"]
export const LOST_FOUND_CATEGORIES = ["ID / Cards", "Electronics", "Books", "Clothing", "Keys", "Bags", "Other"]
export const MARKET_CATEGORIES = ["Books", "Electronics", "Furniture", "Cycles", "Study materials", "Other"]
export const GALLERY_CATEGORIES = ["Events", "Clubs", "Campus", "Fest", "Sports", "Cultural"]
export const ANNOUNCEMENT_CATEGORIES = ["General", "Academic", "Administrative", "Hostel", "Examination", "Events", "Placements"]
