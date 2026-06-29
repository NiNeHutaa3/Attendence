'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { CheckInComponent } from '@/components/dashboard/CheckInComponent'

export default function KaryawanDashboard() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [now, setNow] = useState<Date | null>(null)

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
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      router.replace('/login')
      router.refresh()
      window.location.href = '/login'
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

  {/* HEADER */}
  <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">

      {/* LEFT */}
      <div className="flex items-center gap-4">

        <div className="brand-gradient flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-teal-500/20">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            Web Absensi
          </p>

          <p className="truncate text-xs text-slate-500">
            Portal Karyawan
          </p>
        </div>

      </div>

      {/* RIGHT */}
      <div className="flex min-w-0 items-center gap-3">

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">
            {userName}
          </p>

          <p className="text-xs text-slate-500">
            {user?.email}
          </p>
        </div>

        <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 sm:flex">
          {initials}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="min-h-10 flex-shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:px-4"
        >
          Logout
        </button>

      </div>
    </div>
  </header>

  {/* MAIN */}
  <main className="mx-auto max-w-7xl px-4 py-4 lg:px-8 lg:py-8">

    {/* HERO */}
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl shadow-slate-300/60 lg:p-8">

      <div className="dashboard-grid absolute inset-0 opacity-25" />

      <div className="relative z-10 grid gap-5 lg:gap-10 lg:grid-cols-[1fr_320px]">

        {/* LEFT */}
        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300 lg:text-sm">
            Dashboard Hari Ini
          </p>

          <h1 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
            Selamat datang, {userName}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 lg:mt-5 lg:text-base lg:leading-7">
            Lakukan check-in dengan validasi lokasi GPS dan dokumentasi foto untuk memastikan kehadiran tercatat dengan akurat.
          </p>

        </div>

        {/* RIGHT */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur lg:p-6">

          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-200 lg:text-sm">
            Waktu Sekarang
          </p>

          <p className="mt-3 text-4xl font-bold tracking-tight lg:mt-5 lg:text-5xl">
            {currentTime}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-300 lg:mt-4">
            {currentDate}
          </p>

          <div className="mt-6 rounded-xl bg-emerald-400/10 p-4 ring-1 ring-emerald-400/20">

            <p className="text-sm font-semibold text-emerald-300">
              Ketentuan
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-100">
              Pastikan GPS aktif dan berada di area kantor sebelum melakukan check-in.
            </p>

          </div>

        </div>

      </div>

    </section>

    {/* CONTENT */}
    <div className="mt-5 grid gap-8 lg:mt-8 xl:grid-cols-[minmax(0,1fr)_340px]">

      {/* MAIN ACTION */}
      <div className="lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-6 lg:shadow-sm">
        <CheckInComponent />
      </div>

      {/* SIDEBAR */}
      <aside className="hidden space-y-6 xl:block">

        {/* FLOW */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <p className="text-lg font-semibold text-slate-900">
            Alur Absensi
          </p>

          <div className="mt-6 space-y-5">

            {[
              ['01', 'Ambil lokasi GPS'],
              ['02', 'Validasi radius kantor'],
              ['03', 'Ambil foto'],
              ['04', 'Kirim absensi'],
            ].map(([number, title]) => (

              <div key={number} className="flex items-start gap-4">

                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">
                  {number}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {title}
                  </p>
                </div>

              </div>

            ))}

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">
            Kesiapan Perangkat
          </p>

          <div className="mt-5 space-y-3">
            {[
              ['GPS aktif', 'Izinkan lokasi akurasi tinggi'],
              ['Kamera siap', 'Pastikan wajah terlihat jelas'],
              ['Koneksi stabil', 'Jangan tutup halaman saat mengirim'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>

      </aside>

    </div>

  </main>
</div>
  )
}
