import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { authApi } from '@/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function TwoFactor() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.verify2FA(otp)
      if (data.access) localStorage.setItem('access_token', data.access)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      navigate('/')
    } catch (err) {
      if (isAxiosError(err)) {
        setError(String(err.response?.data?.detail ?? 'Invalid verification code.'))
      } else {
        setError('Invalid verification code.')
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
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Two-factor verification</h1>
          <p className="text-sm text-muted mt-2">
            Enter the 6-digit code from your authenticator app.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
          {error && <div className="alert-danger text-sm">{error}</div>}

          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="text-center text-xl tracking-[0.3em] font-mono-ref"
            placeholder="000000"
            required
            autoComplete="one-time-code"
          />

          <Button type="submit" disabled={loading || otp.length !== 6} className="w-full">
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      </div>
    </div>
  )
}
