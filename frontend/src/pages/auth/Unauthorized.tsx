import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'

export default function Unauthorized() {
  const { user } = useAuth()
  const role = user?.role?.replace(/_/g, ' ') ?? 'unknown'

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Panel className="max-w-md w-full text-center py-12">
        <h1 className="font-serif text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-secondary mt-3">
          Your role ({role}) does not have permission to view this page.
        </p>
        <p className="text-xs text-muted mt-2">Contact your administrator if you need access.</p>
        <Link to="/" className="inline-block mt-6">
          <Button>Back to home</Button>
        </Link>
      </Panel>
    </div>
  )
}
