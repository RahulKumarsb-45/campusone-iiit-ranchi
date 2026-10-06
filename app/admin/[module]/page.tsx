"use client"

import { useParams } from "next/navigation"
import { PageHeader } from "@/components/campus/page-header"
import { ResourceManager } from "@/components/campus/resource-manager"
import { EmptyState } from "@/components/campus/states"
import { ADMIN_MODULES } from "@/lib/admin-config"

export default function AdminModulePage() {
  const { module } = useParams<{ module: string }>()
  const cfg = ADMIN_MODULES.find((m) => m.slug === module)
  if (!cfg) return <EmptyState title="Page not found" description="That management section doesn't exist." />

  // The announcements and notices modules share one table; filter the list by kind.
  const kind = cfg.slug === "announcements" ? "announcement" : cfg.slug === "notices" ? "notice" : cfg.slug === "placements" ? "placement" : cfg.slug === "internships" ? "internship" : undefined

  return (
    <>
      <PageHeader title={`Manage ${cfg.title.toLowerCase()}`} />
      <ResourceManager
        key={cfg.slug}
        table={cfg.table}
        singular={cfg.singular}
        fields={cfg.fields}
        columns={cfg.columns}
        searchKeys={cfg.searchKeys}
        defaults={cfg.defaults}
        onCreateExtras={cfg.extras}
        createHref={cfg.createHref}
        editHref={cfg.editHref}
        canCreate={cfg.canCreate}
        canDelete={cfg.canDelete}
        filter={kind ? { kind } : undefined}
        orderBy={cfg.orderBy}
        ascending={cfg.ascending}
      />
    </>
  )
}
