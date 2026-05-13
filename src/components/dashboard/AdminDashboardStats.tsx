'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DashboardStats = {
  totalUsers: number
  attendanceToday: number
  validCheckIns: number
  invalidCheckIns: number
  loading: boolean
  error?: string
}

export const AdminDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    attendanceToday: 0,
    validCheckIns: 0,
    invalidCheckIns: 0,
    loading: true,
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('user_id', { count: 'exact' })
          .eq('role', 'karyawan')

        const todayLocal = new Date()
        const start = new Date(todayLocal)
        start.setHours(0, 0, 0, 0)
        const end = new Date(todayLocal)
        end.setHours(23, 59, 59, 999)

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())


        const validCount = attendanceData?.filter((a: any) => a.status === 'valid').length || 0
        const invalidCount =
          attendanceData?.filter((a: any) => a.status === 'invalid').length || 0

        setStats({
          totalUsers: userData?.length || 0,
          attendanceToday: attendanceData?.length || 0,
          validCheckIns: validCount,
          invalidCheckIns: invalidCount,
          loading: false,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load stats',
        }))
      }
    }

    fetchStats()
  }, [])

  const StatCard = ({
    label,
    value,
    icon,
    color = 'blue',
  }: {
    label: string
    value: number | string
    icon: React.ReactNode
    color?: 'blue' | 'green' | 'red' | 'yellow'
  }) => {
    const colorMap = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
      green: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
      red: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
      yellow: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
    }

    return (
      <div className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-500">{label}</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          </div>
          <div className={'flex h-12 w-12 items-center justify-center rounded-xl ring-1 ' + colorMap[color].bg + ' ' + colorMap[color].ring}>
            <span className={colorMap[color].text}>{icon}</span>
          </div>
        </div>
      </div>
    )
  }

  if (stats.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-base p-6 skeleton h-24" />
        ))}
      </div>
    )
  }

  const validRate =
    stats.attendanceToday > 0
      ? Math.round((stats.validCheckIns / stats.attendanceToday) * 100)
      : 0
  const invalidRate =
    stats.attendanceToday > 0
      ? Math.round((stats.invalidCheckIns / stats.attendanceToday) * 100)
      : 0

  return (
    <div className="space-y-6">
      {stats.error && <div className="alert-error">{stats.error}</div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Employees"
          value={stats.totalUsers}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Check-in Today"
          value={stats.attendanceToday}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Valid Check-in"
          value={stats.validCheckIns}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
        <StatCard
          label="Invalid Check-in"
          value={stats.invalidCheckIns}
          color="red"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">
                Validation Health
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Today at a glance</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Compare valid and invalid check-ins to spot attendance issues early in the day.
              </p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {stats.attendanceToday} records
            </span>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Valid check-ins</span>
                <span className="font-semibold text-emerald-600">{validRate}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: validRate + '%' }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Invalid check-ins</span>
                <span className="font-semibold text-rose-600">{invalidRate}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: invalidRate + '%' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-lg shadow-amber-100/50">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700">
            Admin Focus
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Review exceptions first
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-900/75">
            Invalid records usually need quick checking: wrong location, GPS drift, or missed office
            radius. Open Attendance Review and filter by invalid status.
          </p>
        </div>
      </div>
    </div>
  )
}
