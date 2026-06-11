import { useState, useEffect, useCallback, useMemo } from 'react'
import { workflowApi, unwrapList } from '@/api'
import type { WorkflowInstance } from '@/types/api'

export function useWorkflows(params?: Record<string, string>) {
  const paramKey = useMemo(() => JSON.stringify(params ?? {}), [params])
  const [instances, setInstances] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    return workflowApi.getInstances(params)
      .then(({ data }) => setInstances(unwrapList(data)))
      .catch(() => setInstances([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { instances, loading, refresh }
}
