import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api'
import { Shield, AlertCircle } from 'lucide-react'

export default function TwoFactor() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.verify2FA(otp)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Enter the 6-digit code from your authenticator app</p>
          </div>

          {error && (
            <div className="alert-danger mb-6">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="input text-center text-2xl tracking-widest"
              placeholder="000000"
              required
            />
            <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full py-2.5">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
