import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(email, password)
      if (data.requires2fa) {
        navigate('/auth/two-factor', { state: { email } })
      } else {
        navigate('/')
      }
    } catch (err) {
      if (!isAxiosError(err)) {
        setError('An unexpected error occurred.')
      } else if (!err.response) {
        setError('Cannot reach the API server. Ensure Docker services are running.')
      } else if (err.response.status === 423) {
        setError(String(err.response.data?.detail ?? 'Account temporarily locked.'))
      } else {
        const detail = err.response.data?.detail
        setError(
          typeof detail === 'string'
            ? detail
            : 'Invalid credentials.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-registry-in">
        <header className="mb-8 text-center">
          <p className="label-overline mb-2">Government of Vanuatu</p>
          <h1 className="page-title">PSC-DRFMS</h1>
          <p className="text-sm text-muted mt-2">Digital Records & File Management System</p>
        </header>

        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
          {error && <div className="alert-danger text-sm">{error}</div>}

          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@psc.gov.vu"
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  )
}
