import { useState, useEffect, useCallback, useMemo } from 'react'
import { recordsApi, unwrapList } from '@/api'
import type { RecordListItem } from '@/types/api'

export function useRecords(params: Record<string, string | number | boolean>) {
  const paramKey = useMemo(() => JSON.stringify(params), [params])
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    return recordsApi.getRecords(params)
      .then(({ data }) => {
        const list = unwrapList(data)
        setRecords(list)
        setCount('count' in data && data.count != null ? data.count : list.length)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { records, count, loading, refresh }
}
