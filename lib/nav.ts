import {
  Briefcase, Building2, CalendarDays, GraduationCap, Image as ImageIcon, LayoutDashboard, Megaphone,
  PackageSearch, ScrollText, ShoppingBag, Users, type LucideIcon,
} from "lucide-react"

export type NavItem = { label: string; href: string; icon: LucideIcon }

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Clubs", href: "/clubs", icon: Users },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Notices", href: "/notices", icon: ScrollText },
  { label: "Placements", href: "/placements", icon: Briefcase },
  { label: "Internships", href: "/internships", icon: GraduationCap },
  { label: "Campus Services", href: "/services", icon: Building2 },
  { label: "Lost & Found", href: "/lost-found", icon: PackageSearch },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "Gallery", href: "/gallery", icon: ImageIcon },
]
