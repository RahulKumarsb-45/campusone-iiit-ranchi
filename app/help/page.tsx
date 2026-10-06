"use client"

import Link from "next/link"
import { Phone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/campus/page-header"
import { useRows } from "@/hooks/use-rows"
import type { ServiceType } from "@/lib/supabase"

const FAQ = [
  ["How do I register for an event?", "Open the event from the Events page and press Register. You can cancel from the same page until the event starts."],
  ["I can't see Lost & Found or Marketplace.", "Those sections are for signed-in CampusOne users. Sign in or create an account first."],
  ["How do I join a club?", "Open the club from the Clubs page and press Join club. You can leave at any time."],
  ["How do I become an event organizer or club admin?", "Organizer and admin access is granted by a CampusOne administrator. Contact your club's faculty coordinator or the administration."],
  ["I forgot my password.", "Use “Forgot password?” on the sign-in page to get a reset link by email."],
]

export default function HelpPage() {
  const { rows } = useRows<ServiceType>("campus_services", { eq: { is_published: true, category: "Emergency" } })
  return (
    <div className="mx-auto w-full max-w-3xl p-4 py-6 lg:p-6">
      <PageHeader title="Help & Support" description="Answers to common questions about CampusOne." />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-lg border bg-card p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted-foreground">{a}</p></details>
        ))}
      </div>
      {rows.length > 0 && (
        <section className="mt-8" aria-labelledby="contacts"><h2 id="contacts" className="mb-3 text-lg font-semibold">Important contacts</h2>
          <div className="grid gap-3 sm:grid-cols-2">{rows.map((s) => <Card key={s.id}><CardContent className="p-4"><p className="font-medium">{s.title}</p>{s.contact && <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{s.contact}</p>}</CardContent></Card>)}</div>
        </section>
      )}
      <p className="mt-8 text-sm text-muted-foreground">More contacts and facilities are listed under <Link href="/services" className="text-primary hover:underline">Campus Services</Link>.</p>
    </div>
  )
}
