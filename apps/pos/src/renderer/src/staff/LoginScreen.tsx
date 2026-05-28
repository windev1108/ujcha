import { useState } from 'react'
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { usePosStore } from '../store/pos-store'
import type { PosConfig, AdminUser } from '../types/common'
import { DEFAULT_CONFIG } from '../types/common'
import axios from 'axios'
import { API_URL } from '../api'
import logoUrl from '../assets/logo.png'

const eAPI = (window as unknown as {
  electronAPI?: {
    store: { get(): Promise<Record<string, unknown>>; set(d: Record<string, unknown>): Promise<void> }
  }
}).electronAPI

const ALLOWED_ROLES: AdminUser['role'][] = ['super_admin', 'staff']

export function LoginScreen() {
  const { setPosConfig } = usePosStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post<{ admin: AdminUser; accessToken: string; refreshToken: string }>(
        `${API_URL}/admin/auth/email`,
        { email: email.trim().toLowerCase(), password },
      )

      const { admin, accessToken, refreshToken } = data

      if (!ALLOWED_ROLES.includes(admin.role)) {
        setError('Tài khoản này không có quyền truy cập POS.')
        return
      }

      const cfg: PosConfig = {
        ...DEFAULT_CONFIG,
        accessToken,
        refreshToken,
        adminUser: admin,
      }

      await eAPI!.store.set(cfg as unknown as Record<string, unknown>)
      setPosConfig(cfg)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const code = err.response?.data?.code
        if (code === 'ADMIN_INVALID_CREDENTIALS') {
          setError('Email hoặc mật khẩu không đúng.')
        } else {
          setError(err.response?.data?.message ?? 'Đăng nhập thất bại. Kiểm tra lại kết nối.')
        }
      } else {
        setError('Đã xảy ra lỗi không xác định.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleLogin()
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand to-brand-light p-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-2xl shadow-brand/30">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src={logoUrl} alt="UjCha" className="mx-auto h-24 w-24 object-contain" />
          <h1 className="mt-3 text-2xl font-bold text-brand">UjCha POS</h1>
          <p className="mt-1 text-sm text-gray-400">Đăng nhập để bắt đầu bán hàng</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-gray-50"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mật khẩu"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-10 text-sm text-gray-700 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang xác thực…
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Chỉ tài khoản <strong>super_admin</strong> hoặc <strong>staff</strong> mới được phép đăng nhập.
        </p>
      </div>
    </div>
  )
}