import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Unauthorized() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <ShieldOff size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-1">
        Your role <span className="font-medium text-slate-700 dark:text-slate-300">({user?.role?.replace('_', ' ')})</span> does not have permission to view this page.
      </p>
      <p className="text-slate-400 dark:text-slate-500 text-sm mb-6">Contact your Administrator if you need access.</p>
      <Link to="/" className="btn-primary px-6 py-2">Back to Dashboard</Link>
    </div>
  )
}
