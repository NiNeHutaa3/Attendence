'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Attendance, User } from '@/types'

type AttendanceRecord = Attendance & {
  user: User
}

export const AttendanceHistory = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const todayStr = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState<string>(todayStr)
  const [endDate, setEndDate] = useState<string>(todayStr)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid'>('all')

  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchRecords()
  }, [startDate, endDate, selectedUser, statusFilter])


  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'karyawan')
        .order('name')

      setUsers(data || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchRecords = async () => {
    try {
      setLoading(true)

      // Build boundaries in *local time* to avoid UTC shift.
      // startDate/endDate are from <input type="date" /> as YYYY-MM-DD.
      const [sY, sM, sD] = startDate.split('-').map(Number)
      const [eY, eM, eD] = endDate.split('-').map(Number)

      const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
      const end = new Date(eY, eM - 1, eD, 23, 59, 59, 999)

      let attendanceQuery = supabase
        .from('attendance')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (selectedUser !== 'all') {
        attendanceQuery = attendanceQuery.eq('user_id', selectedUser)
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery.order(
        'created_at',
        { ascending: false }
      )

      if (attendanceError) throw attendanceError

      const attendance = (attendanceData || []) as Attendance[]

      if (attendance.length === 0) {
        setRecords([])
        return
      }

      // Fetch users separately (avoid join relationship dependency)
      const userIds = Array.from(new Set(attendance.map((a) => a.user_id)))

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('user_id, email, name, role')
        .in('user_id', userIds)

      if (usersError) throw usersError

      // Debug: to ensure mapping between attendance.user_id and users.user_id works
      console.log('[AttendanceHistory] attendance userIds:', userIds)
      console.log('[AttendanceHistory] usersData length:', (usersData || []).length)


      const usersById = new Map(
        (usersData || []).map((u: any) => [u.user_id as string, u as User])
      )

      setRecords(
        attendance.map((record) => {
          const user = usersById.get(record.user_id) as User | undefined
          return {
            ...(record as any),
            user: user as User,
          }
        })
      )
    } catch (error: any) {
      console.error('Error fetching records:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(
    (record) => statusFilter === 'all' || record.status === statusFilter
  )
  const validRecords = filteredRecords.filter((record) => record.status === 'valid').length
  const invalidRecords = filteredRecords.filter((record) => record.status === 'invalid').length

  return (
      <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Riwayat Absensi</h2>
          <p className="mt-1 text-sm text-slate-500">Filter check-in harian berdasarkan tanggal dan karyawan.</p>
        </div>
      </div>

      <div className="card-base p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_14rem]">
          <div>
            <label htmlFor="startDate" className="mb-2 block text-sm font-semibold text-slate-700">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="mb-2 block text-sm font-semibold text-slate-700">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label htmlFor="user" className="mb-2 block text-sm font-semibold text-slate-700">
              Karyawan
            </label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="input-base"
            >
              <option value="all">Semua Karyawan</option>
              {users.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-semibold text-slate-700">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'valid' | 'invalid')}
              className="input-base"
            >
              <option value="all">Semua Status</option>
              <option value="valid">Valid</option>
              <option value="invalid">Tidak Valid</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-slate-600">
            Rekap: <span className="font-bold text-slate-950">{filteredRecords.length}</span> data
          </p>

          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              try {
                setError(null)
                const { data: sessionData } = await supabase.auth.getSession()
                const token = sessionData.session?.access_token

                if (!token) throw new Error('Session admin tidak ditemukan. Silakan login ulang.')

                const params = new URLSearchParams()
                params.set('startDate', startDate)
                params.set('endDate', endDate)
                params.set('userId', selectedUser)
                params.set('status', statusFilter)

                const res = await fetch(
                  `/api/admin/attendance/export?${params.toString()}`,
                  {
                    method: 'GET',
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                )

                if (!res.ok) {
                  const body = await res.json().catch(() => null)
                  throw new Error(body?.error || 'Gagal mengunduh report')
                }

                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)

                const a = document.createElement('a')
                a.href = url
                a.download = `attendance_${startDate}_to_${endDate}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
              } catch (e: any) {
                setError(e.message || 'Gagal mengunduh report')
              }
            }}
            disabled={loading}
          >
            Unduh Report (Excel)
          </button>
        </div>
      </div>


      {error && <div className="alert-error">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-slate-500">Jumlah</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-950">{filteredRecords.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-emerald-700">Valid</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-950">{validRecords}</p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-rose-700">Invalid</p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-950">{invalidRecords}</p>
        </div>
      </div>


      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Check-out
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="spinner mx-auto h-8 w-8" />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-7 4h8M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
                          />
                        </svg>
                      </div>
                      <p className="font-bold text-slate-950">No records found</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try another date, employee, or status filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.attendance_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-semibold text-slate-950">{record.user?.name}</p>
                        <p className="text-xs text-slate-500">{record.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {new Date(record.check_in_time).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {record.check_out_time
                        ? new Date(record.check_out_time).toLocaleTimeString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          record.status === 'valid'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                            : 'bg-rose-50 text-rose-700 ring-rose-100'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
