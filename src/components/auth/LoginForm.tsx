'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage } from '@/lib/auth-errors'

type LoginProfileResult = {
  data: {
    role?: string | null
  } | null
  error: {
    message?: string
  } | null
}

const LOGIN_PROFILE_TIMEOUT_MS = 5000

const getDashboardRole = (role?: string) => (role === 'admin' ? 'admin' : 'karyawan')

const withTimeout = async <T,>(promise: PromiseLike<T>, label: string): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`${label} timed out, continuing with fallback auth data`)
          resolve(null)
        }, LOGIN_PROFILE_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export const LoginForm = () => {
  const [hydrated, setHydrated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setHydrated(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hydrated) {
      return
    }

    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(getAuthErrorMessage(error.message))
        return
      }

      if (data.user) {
        const profileResult = await withTimeout(
          supabase
            .from('users')
            .select('role')
            .eq('user_id', data.user.id)
            .maybeSingle() as PromiseLike<LoginProfileResult>,
          'Loading login profile'
        )

        const userData = profileResult?.data
        const profileError = profileResult?.error

        if (profileError) {
          console.warn('Could not load user profile, falling back to auth metadata:', profileError)
        }

        const role = getDashboardRole(userData?.role || data.user.user_metadata?.role)
        router.replace(`/dashboard/${role}`)
        router.refresh()
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err.message || 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {error && <div className="alert-error">{error}</div>}
      <form onSubmit={handleLogin} action="javascript:void(0)" className="space-y-5">


        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!hydrated || loading}
            placeholder="name@gmail.com"
            className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-black"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!hydrated || loading}
            placeholder="••••••••"
            className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-black"
          />
        </div>

        <button
          type="submit"
          disabled={!hydrated || loading}
          className="mt-4 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-60"
        >
          {!hydrated ? 'Memuat form...' : loading ? 'Memproses...' : 'Masuk'}
        </button>

        <div className="pt-4 text-center text-sm text-slate-500 border-t">
          Belum punya akun? Hubungi admin untuk dibuatkan akses.
        </div>

      </form>
    </div>
  )
}
