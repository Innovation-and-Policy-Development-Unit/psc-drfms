import { useState, useEffect } from 'react'
import { isAxiosError } from 'axios'
import { workflowApi, unwrapList } from '@/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  steps?: unknown[]
  isActive?: boolean
  is_active?: boolean
}

export default function WorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    workflowApi.getTemplates()
      .then(({ data }) => setTemplates(unwrapList<WorkflowTemplate>(data)))
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 403) {
          setError('Administrator access required.')
        } else {
          setError('Failed to load templates.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageShell title="Workflow templates" subtitle="PSSM approval templates configured by administrators.">
      {error && <div className="alert-danger text-sm">{error}</div>}
      {loading ? (
        <Skeleton className="h-40" />
      ) : templates.length === 0 ? (
        <EmptyState title="No templates" description="Workflow templates will appear here once configured." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
          {templates.map((t) => {
            const active = t.isActive ?? t.is_active ?? false
            const stepCount = t.steps?.length ?? 0
            return (
              <Panel key={t.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{t.name}</h3>
                  <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="text-sm text-muted mt-2">{t.description || 'No description'}</p>
                <p className="text-xs text-muted mt-3">{stepCount} step{stepCount !== 1 ? 's' : ''}</p>
              </Panel>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
