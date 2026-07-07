'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signOutLocal } from '@/lib/supabase'
import { CheckInComponent } from '@/components/dashboard/CheckInComponent'

export default function KaryawanDashboard() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [now, setNow] = useState<Date | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!loading && (!user || user.user_metadata?.role !== 'karyawan')) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)

    try {
      await signOutLocal()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      window.location.replace('/login')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="font-medium text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.user_metadata?.role !== 'karyawan') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="font-medium text-slate-500">Mengalihkan ke login...</p>
        </div>
      </div>
    )
  }

  const userName = user?.user_metadata?.name || 'Karyawan'
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const currentTime = now
    ? now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--'
  const currentDate = now
    ? now.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Memuat waktu...'

  return (
    <div className="app-surface min-h-screen text-slate-900">
  <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/60">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <div className="brand-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-teal-700/15">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Web Absensi</p>
          <p className="truncate text-xs text-slate-500">Karyawan</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">{userName}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 sm:flex">
          {initials}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="min-h-10 flex-shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:px-4"
        >
          {loggingOut ? 'Keluar...' : 'Logout'}
        </button>
      </div>
    </div>
  </header>

  <main className="mx-auto max-w-5xl px-4 py-5 lg:px-8">
    <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Absensi
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            {userName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{currentDate}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Jam
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{currentTime}</p>
        </div>
      </div>
    </section>

    <div>
      <div>
        <CheckInComponent />
      </div>
    </div>
  </main>
</div>
  )
}
