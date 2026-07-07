'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type DashboardNavItem = {
  id: string
  label: string
  description?: string
  icon: ReactNode
}

type DashboardShellProps = {
  title: string
  subtitle: string
  eyebrow: string
  navItems?: DashboardNavItem[]
  activeItem?: string
  onNavChange?: (id: string) => void
  children: ReactNode
  sidebarFooter?: ReactNode
}

export const DashboardShell = ({
  title,
  subtitle,
  eyebrow,
  navItems = [],
  activeItem,
  onNavChange,
  children,
  sidebarFooter,
}: DashboardShellProps) => {
  const router = useRouter()
  const { user } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const userName = user?.user_metadata?.name || 'User'
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut({ scope: 'global' })
      router.replace('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="app-surface min-h-screen text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40 lg:flex lg:flex-col">
        <div className="flex-shrink-0 border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg shadow-teal-700/15">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">Web Absensi</p>
            </div>
          </div>
        </div>

        {navItems.length > 0 && (
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const isActive = activeItem === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavChange?.(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isActive
                      ? 'brand-gradient text-white shadow-lg shadow-teal-700/15'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex-shrink-0 space-y-4 border-t border-slate-100 bg-white p-3">
          {sidebarFooter}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                {initials || 'U'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{userName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-secondary mt-3 w-full text-sm"
            >
              {loggingOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">Web Absensi</p>
                <p className="truncate text-xs text-slate-500">{userName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-secondary min-h-10 flex-shrink-0 px-3 text-sm"
            >
              {loggingOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </header>

        {navItems.length > 0 && (
          <div className="sticky top-16 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavChange?.(item.id)}
                  className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    activeItem === item.id ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm shadow-slate-200/70">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {eyebrow}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {title}
                </h1>
                {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
              </div>
              <div className="min-w-0 text-sm text-slate-500 lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Login aktif
                </p>
                <p className="mt-1 max-w-[18rem] truncate font-semibold text-slate-700">
                  {user?.email}
                </p>
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  )
}
