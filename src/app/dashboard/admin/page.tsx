'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { DashboardShell, type DashboardNavItem } from '@/components/common/DashboardShell'
import { AdminDashboardStats } from '@/components/dashboard/AdminDashboardStats'
import { UserManagement } from '@/components/dashboard/UserManagement'
import { AttendanceHistory } from '@/components/dashboard/AttendanceHistory'

type TabType = 'overview' | 'users' | 'attendance'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  useEffect(() => {
    if (!loading && (!user || user.user_metadata?.role !== 'admin')) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="font-medium text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.user_metadata?.role !== 'admin') {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="font-medium text-slate-500">Mengalihkan ke login...</p>
        </div>
      </div>
    )
  }

  const tabs: DashboardNavItem[] = [
    {
      id: 'overview',
      label: 'Ringkasan',
      description: 'Statistik dan validasi hari ini',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
          />
        </svg>
      ),
    },
    {
      id: 'users',
      label: 'Pengguna',
      description: 'Kelola akses karyawan',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      id: 'attendance',
      label: 'Riwayat',
      description: 'Periksa catatan kehadiran',
      icon: (
        <svg
          className="w-5 h-5"
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
      ),
    },
  ]

  const pageCopy = {
    overview: {
      title: 'Ringkasan Kehadiran',
      subtitle: 'Pantau kehadiran harian, jumlah karyawan, dan hasil validasi lokasi dari satu dashboard.',
      eyebrow: 'Dashboard Admin',
    },
    users: {
      title: 'Direktori Pengguna',
      subtitle: 'Buat akun karyawan, periksa role, dan kelola akses dashboard dengan lebih mudah.',
      eyebrow: 'Kelola Pengguna',
    },
    attendance: {
      title: 'Riwayat Kehadiran',
      subtitle: 'Filter catatan berdasarkan tanggal atau karyawan dan temukan data yang perlu diperiksa.',
      eyebrow: 'Catatan Harian',
    },
  }[activeTab]

  return (
    <DashboardShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      eyebrow={pageCopy.eyebrow}
      navItems={tabs}
      activeItem={activeTab}
      onNavChange={(id) => setActiveTab(id as TabType)}
    >
      {activeTab === 'overview' && <AdminDashboardStats />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'attendance' && <AttendanceHistory />}
    </DashboardShell>
  )
}
