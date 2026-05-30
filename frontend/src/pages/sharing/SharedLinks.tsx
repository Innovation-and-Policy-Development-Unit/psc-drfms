import { useState, useEffect } from 'react'
import { sharingApi, unwrapList } from '@/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

interface SharedLink {
  id: string | number
  token: string
  recordTitle?: string
  record_title?: string
  accessCount?: number
  access_count?: number
  isActive?: boolean
  is_active?: boolean
}

export default function SharedLinks() {
  const [links, setLinks] = useState<SharedLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sharingApi.getLinks()
      .then(({ data }) => setLinks(unwrapList<SharedLink>(data)))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }, [])

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`)
  }

  const revoke = async (token: string) => {
    await sharingApi.revokeLink(token)
    setLinks((prev) => prev.map((l) => (
      l.token === token ? { ...l, isActive: false, is_active: false } : l
    )))
  }

  return (
    <PageShell
      title="Shared links"
      subtitle="External links created from document share actions."
    >
      {loading ? (
        <Skeleton className="h-40" />
      ) : links.length === 0 ? (
        <EmptyState
          title="No share links"
          description="Open a document and use Share to create an external link."
        />
      ) : (
        <div className="space-y-2 max-w-3xl">
          {links.map((link) => {
            const title = link.recordTitle ?? link.record_title ?? 'Untitled record'
            const views = link.accessCount ?? link.access_count ?? 0
            const active = link.isActive ?? link.is_active ?? false
            return (
              <Panel key={link.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{title}</p>
                  <p className="text-xs font-mono-ref text-muted truncate mt-0.5">{link.token}</p>
                  <p className="text-xs text-muted mt-1">
                    {views} view{views !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Revoked'}</Badge>
                {active && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => copyLink(link.token)}>Copy</Button>
                    <Button variant="danger" size="sm" onClick={() => revoke(link.token)}>Revoke</Button>
                  </>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
