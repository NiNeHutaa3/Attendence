'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccessLog, Attendance, LocationLog, PhotoAttendance, User } from '@/types'

type AttendanceRecord = Attendance & {
  user: User | null
  photos: PhotoAttendance[]
  locations: LocationLog[]
  access_logs: AccessLog[]
}

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-'

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

const calculateLocationAccuracy = (distance?: number | null, radius?: number | null) => {
  const numericDistance = Number(distance)
  const numericRadius = Number(radius)

  if (!Number.isFinite(numericDistance) || !Number.isFinite(numericRadius) || numericRadius <= 0) {
    return null
  }

  return Math.round(Math.max(0, Math.min(100, (1 - numericDistance / numericRadius) * 100)))
}

const getAccuracyStyle = (accuracy: number) => {
  if (accuracy >= 75) {
    return {
      label: 'Sangat dekat',
      text: 'text-emerald-700',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    }
  }

  if (accuracy >= 40) {
    return {
      label: 'Cukup dekat',
      text: 'text-amber-700',
      bar: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 ring-amber-100',
    }
  }

  return {
    label: 'Dekat batas radius',
    text: 'text-rose-700',
    bar: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-100',
  }
}

const getSessionToken = async () => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Session admin tidak ditemukan. Silakan login ulang.')
  }

  return token
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
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchRecords()
  }, [startDate, endDate, selectedUser, statusFilter])


  const fetchUsers = async () => {
    try {
      const token = await getSessionToken()
      const response = await fetch('/api/admin/users/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Gagal memuat daftar karyawan')
      }

      const body = (await response.json()) as { users?: User[] }
      setUsers((body.users || []).filter((user) => user.role === 'karyawan'))
    } catch (error: any) {
      console.error('Error fetching users:', error)
      setError(error.message || 'Gagal memuat daftar karyawan')
    }
  }

  const fetchRecords = async () => {
    try {
      setLoading(true)

      const token = await getSessionToken()
      const params = new URLSearchParams()
      params.set('startDate', startDate)
      params.set('endDate', endDate)
      params.set('userId', selectedUser)
      params.set('status', statusFilter)

      const response = await fetch(`/api/admin/attendance?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Gagal memuat data absensi')
      }

      const body = (await response.json()) as { records?: AttendanceRecord[] }
      setRecords(body.records || [])
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
  const selectedCheckInPhoto = selectedRecord?.photos.find((photo) => photo.event_type === 'checkin')
  const selectedCheckOutPhoto = selectedRecord?.photos.find((photo) => photo.event_type === 'checkout')
  const selectedPhotos: Array<[string, PhotoAttendance | undefined]> = [
    ['Check-in Photo', selectedCheckInPhoto],
    ['Check-out Photo', selectedCheckOutPhoto],
  ]
  const geofenceRadius = selectedRecord?.user?.geofence?.radius
  const checkInLocation = selectedRecord?.locations.find(
    (location) => (location.event_type || 'checkin') === 'checkin'
  )
  const checkInAccuracy = calculateLocationAccuracy(
    checkInLocation?.distance_from_center,
    geofenceRadius
  )

  return (
      <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Riwayat Absensi</h2>
          <p className="mt-1 text-sm text-slate-500">Cari, periksa, dan unduh catatan kehadiran tim.</p>
        </div>
      </div>

      <div className="card-base p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_14rem]">
          <div>
            <label htmlFor="startDate" className="mb-2 block text-sm font-semibold text-slate-700">
              Tanggal Mulai
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
              Tanggal Akhir
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
                const token = await getSessionToken()

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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-1 text-sm font-semibold text-slate-500">Jumlah</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-950">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-emerald-700">Valid</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-950">{validRecords}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:p-5">
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
                  Karyawan
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
                  Aksi
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
                      <p className="font-bold text-slate-950">Data tidak ditemukan</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Coba rentang tanggal, karyawan, atau filter status yang lain.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.attendance_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {record.user?.name || 'Profil tidak ditemukan'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {record.user?.email || record.user_id}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {formatTime(record.check_in_time)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {formatTime(record.check_out_time)}
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
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="text-xs font-bold text-teal-700 transition-colors hover:text-teal-900"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                  Detail Kehadiran
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  {selectedRecord.user?.name || 'Profil tidak ditemukan'}
                </h3>
                <p className="text-sm text-slate-500">
                  {selectedRecord.user?.email || selectedRecord.user_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Check-in</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {formatDateTime(selectedRecord.check_in_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Check-out</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {formatDateTime(selectedRecord.check_out_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-950">
                    {selectedRecord.status}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Akurasi Lokasi</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {checkInAccuracy === null ? 'Belum tersedia' : `${checkInAccuracy}%`}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {selectedPhotos.map(([label, photo]) => (
                  <div key={label} className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-bold text-slate-950">{label}</p>
                    {photo ? (
                      <a href={photo.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={photo.photo_url}
                          alt={label}
                          className="aspect-video w-full rounded-lg object-cover ring-1 ring-slate-200"
                        />
                      </a>
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500">
                        Foto belum tersedia
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-bold text-slate-950">Catatan Lokasi</p>
                  <div className="space-y-3">
                    {selectedRecord.locations.length > 0 ? (
                      selectedRecord.locations.map((location) => {
                        const accuracy = calculateLocationAccuracy(
                          location.distance_from_center,
                          geofenceRadius
                        )
                        const accuracyStyle = accuracy === null ? null : getAccuracyStyle(accuracy)

                        return (
                        <div key={location.location_id} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold capitalize text-slate-950">
                              {location.event_type || 'checkin'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(location.created_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-slate-600">
                            {location.latitude}, {location.longitude}
                          </p>
                          <p className="mt-1 text-slate-600">
                            Jarak: {Number(location.distance_from_center).toFixed(1)} m
                          </p>
                          <p className="mt-1 text-slate-600">
                            Radius geofence: {geofenceRadius ? `${Number(geofenceRadius)} m` : '-'}
                          </p>
                          {accuracy !== null && accuracyStyle && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                  Akurasi lokasi
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${accuracyStyle.badge}`}>
                                  {accuracy}%
                                </span>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${accuracyStyle.bar}`}
                                  style={{ width: `${accuracy}%` }}
                                />
                              </div>
                              <p className={`mt-2 text-xs font-semibold ${accuracyStyle.text}`}>
                                {accuracyStyle.label}
                              </p>
                            </div>
                          )}
                        </div>
                      )})
                    ) : (
                      <p className="text-sm text-slate-500">Belum ada data lokasi.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-950">Catatan Akses</p>
                  <div className="space-y-3">
                    {selectedRecord.access_logs.length > 0 ? (
                      selectedRecord.access_logs.map((log) => (
                        <div key={log.log_id} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold capitalize text-slate-950">
                              {log.event_type || 'checkin'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-slate-600">IP: {log.ip_address || '-'}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                            {log.user_agent || '-'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Belum ada access log.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
