'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type NavHeaderProps = {
  title?: string
}

export const NavHeader = ({ title = 'Dashboard' }: NavHeaderProps) => {
  const router = useRouter()
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0F172A]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B82F6] text-white shadow-lg shadow-blue-500/25">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#E2E8F0]">Web Absensi</h1>
              <p className="text-xs font-medium text-[#64748B]">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-white/[0.06] bg-[#1E293B] px-3 py-2 text-right sm:block">
              <p className="max-w-[16rem] truncate text-sm font-semibold text-[#E2E8F0]">
                {user?.email}
              </p>
              <p className="text-xs font-medium text-[#64748B]">
                {user?.user_metadata?.name || 'User'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

