import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(email, password)
      if (data.requires_2fa) {
        navigate('/auth/two-factor', { state: { email } })
      } else {
        navigate('/')
      }
    } catch (err) {
      if (!err.response) {
        setError(
          'Cannot reach the API server. Start Docker Desktop, then in the project folder run: docker compose up -d --build'
        )
      } else if (err.response?.status === 423) {
        setError(err.response.data?.detail || 'Account is temporarily locked. Try again later.')
      } else {
        const detail = err.response?.data?.detail
        const message = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.join(' ')
            : err.response?.data?.non_field_errors?.[0]
        setError(message || 'Invalid credentials. Use email admin@psc.gov.vu (not username "admin").')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Lock size={20} />
            </div>
            <div>
              <div className="font-bold text-lg">PSC-DRFMS</div>
              <div className="text-primary-200 text-xs">Government of Vanuatu</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Your documents.<br />One secure library.</h1>
          <p className="text-primary-200 text-lg leading-relaxed">
            Store, find, preview, and share files — with government-grade classification,
            retention, and audit built in for the Public Service Commission.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            ['OCR Search', 'Find any text inside scanned documents'],
            ['Legal Holds', 'Freeze records for compliance'],
            ['Workflows', '21-day PSSM approval tracking'],
            ['2FA Security', 'Government-grade access control'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white/10 rounded-xl p-4">
              <div className="font-semibold mb-1">{title}</div>
              <div className="text-primary-200 text-xs">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={28} className="text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign in</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">PSC Document Library</p>
          </div>

          {error && (
            <div className="alert-danger mb-6">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@psc.gov.vu"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
            Sign in with your <strong>email address</strong> (same as Django admin).<br />
            Contact the Administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  )
}
