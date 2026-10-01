import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Logo from '@/components/shared/Logo'
import { Check } from 'lucide-react'

export default function Login() {
  const { t } = useTranslation()
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
        setError(t('login.error_unexpected'))
      } else if (!err.response) {
        setError(t('common.error_network'))
      } else if (err.response.status === 423) {
        setError(String(err.response.data?.detail ?? t('login.error_locked')))
      } else {
        const detail = err.response.data?.detail
        setError(
          typeof detail === 'string'
            ? detail
            : t('login.error_invalid'),
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-gray-950">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -start-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo size={40} className="!bg-white" />
          <div>
            <p className="text-lg font-semibold tracking-tight">PSC-DRFMS</p>
            <p className="text-[11px] uppercase tracking-widest text-white/70">{t("login.government")}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-sans text-4xl font-semibold leading-tight tracking-tight text-white">
            Every record, secured and accounted for.
          </h2>
          <p className="mt-4 text-white/80">
            Capture, classify, retain and dispose of public service records with a complete audit trail and role-based access.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {["Retention schedules and legal holds", "Approval workflows with full audit trail", "Secure sharing and version history"].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15"><Check size={14} /></span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Public Service Commission, Republic of Vanuatu</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-registry-in">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <Logo size={36} />
            <p className="text-lg font-semibold text-gray-900 dark:text-white">PSC-DRFMS</p>
          </div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-500">{t("login.system_name")}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <div className="alert-danger text-sm">{error}</div>}

            <Input
              label={t("login.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@psc.gov.vu"
              required
              autoComplete="email"
            />

            <Input
              label={t("login.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button type="submit" disabled={loading} className="w-full !h-11 !rounded-xl">
              {loading ? t("login.signing_in") : t("common.sign_in")}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">{t("common.contact_admin")}</p>
        </div>
      </div>
    </div>
  )
}
