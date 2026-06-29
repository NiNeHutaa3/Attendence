'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import type { AttendanceDetail, Geofence, User } from '@/types'

type UserRole = 'admin' | 'karyawan'

const getSessionToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Admin session tidak ditemukan. Silakan login ulang.')
  }

  return session.access_token
}

const getInitials = (name: string, email: string) =>
  (name || email)
    .split(/[ @._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-'

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

const getCurrentMonthValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getMonthRange = (monthValue: string) => {
  const [yearValue, monthIndexValue] = monthValue.split('-').map(Number)
  const year = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear()
  const monthIndex = Number.isFinite(monthIndexValue) ? monthIndexValue - 1 : new Date().getMonth()
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0)

  const toDateInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  }
}

const formatPercent = (value: number) => `${Math.round(value)}%`

const getUserErrorHelp = (message: string) => {
  const normalized = message.toLowerCase()

  if (normalized.includes('already') || normalized.includes('terdaftar')) {
    return 'Email sudah dipakai akun lain. Gunakan email berbeda atau edit akun yang sudah ada.'
  }

  if (normalized.includes('password')) {
    return 'Pastikan password minimal 6 karakter dan tidak dikosongkan saat membuat akun baru.'
  }

  if (normalized.includes('geofence') || normalized.includes('lokasi')) {
    return 'Untuk role karyawan, lokasi kerja dan radius geofence wajib dipilih.'
  }

  if (normalized.includes('session') || normalized.includes('unauthorized') || normalized.includes('admin')) {
    return 'Sesi admin tidak valid atau sudah habis. Login ulang sebagai admin, lalu coba lagi.'
  }

  if (normalized.includes('environment') || normalized.includes('supabase')) {
    return 'Konfigurasi Supabase belum lengkap. Periksa env Supabase, termasuk service role key untuk admin.'
  }

  return 'Periksa kembali data yang diisi. Jika semua sudah benar, coba refresh halaman dan ulangi proses.'
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([])
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'karyawan' as UserRole,
    password: '',
    geofenceId: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'karyawan'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailMonth, setDetailMonth] = useState(getCurrentMonthValue)
  const [detailRecords, setDetailRecords] = useState<AttendanceDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchGeofences()
  }, [])

  useEffect(() => {
    if (!selectedUser) {
      return
    }

    fetchUserAttendanceDetail(selectedUser, detailMonth)
  }, [detailMonth, selectedUser])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = await getSessionToken()

      const response = await fetch('/api/admin/users/list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() }

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to fetch users')
      }

      setUsers(result.users || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofence')
        .select('*')
        .order('location_name', { ascending: true })
        .order('radius', { ascending: true })

      if (error) throw error

      setGeofences(data || [])
      setFormData((current) => ({
        ...current,
        geofenceId: current.geofenceId || data?.[0]?.geofence_id || '',
      }))
    } catch (error: any) {
      console.error('Error fetching geofences:', error)
      setError(error.message || 'Failed to load geofence options')
    }
  }

  const resetForm = () => {
    setEditingUserId(null)
    setFormData({
      email: '',
      name: '',
      role: 'karyawan',
      password: '',
      geofenceId: geofences[0]?.geofence_id || '',
    })
  }

  const resetDetail = () => {
    setSelectedUser(null)
    setDetailRecords([])
    setDetailError(null)
  }

  const startEditUser = (targetUser: User) => {
    resetDetail()
    setEditingUserId(targetUser.user_id)
    setFormData({
      email: targetUser.email,
      name: targetUser.name || '',
      role: targetUser.role,
      password: '',
      geofenceId:
        targetUser.role === 'karyawan'
          ? targetUser.geofence_id || targetUser.geofence?.geofence_id || geofences[0]?.geofence_id || ''
          : '',
    })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  const fetchUserAttendanceDetail = async (targetUser: User, monthValue = detailMonth) => {
    if (targetUser.role !== 'karyawan') {
      setDetailRecords([])
      return
    }

    try {
      setDetailLoading(true)
      setDetailError(null)

      const token = await getSessionToken()
      const { startDate, endDate } = getMonthRange(monthValue)
      const params = new URLSearchParams({
        startDate,
        endDate,
        userId: targetUser.user_id,
        status: 'all',
      })

      const response = await fetch(`/api/admin/attendance?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() }

      if (!response.ok) {
        throw new Error(result?.error || 'Gagal memuat detail absensi karyawan')
      }

      setDetailRecords(result.records || [])
    } catch (error: any) {
      setDetailRecords([])
      setDetailError(error.message || 'Gagal memuat detail absensi karyawan')
    } finally {
      setDetailLoading(false)
    }
  }

  const openUserDetail = (targetUser: User) => {
    setShowForm(false)
    resetForm()
    setSelectedUser(targetUser)
    setDetailMonth(getCurrentMonthValue())
    setDetailRecords([])
    setDetailError(null)
  }

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.email || !formData.name || (!editingUserId && !formData.password)) {
      setError(editingUserId ? 'Nama dan email wajib diisi' : 'Nama, email, dan password wajib diisi')
      return
    }

    if (formData.role === 'karyawan' && !formData.geofenceId) {
      setError('Pilih lokasi dan radius geofence untuk karyawan')
      return
    }

    try {
      setSaving(true)
      const token = await getSessionToken()

      const response = await fetch('/api/admin/users', {
        method: editingUserId ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUserId,
          email: formData.email,
          password: formData.password || undefined,
          name: formData.name,
          role: formData.role,
          geofenceId: formData.role === 'karyawan' ? formData.geofenceId : null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || (editingUserId ? 'Failed to update user' : 'Failed to add user'))
      }

      setSuccess(
        editingUserId
          ? `User ${formData.name} berhasil diperbarui`
          : `User ${formData.name} berhasil ditambahkan`
      )
      resetForm()
      setShowForm(false)
      await fetchUsers()
    } catch (error: any) {
      setError(getAuthErrorMessage(error.message || 'Failed to save user'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (targetUser: User) => {
    const confirmed = confirm(
      `Hapus ${targetUser.name || targetUser.email}? Akun login dan data profil user akan dihapus.`
    )

    if (!confirmed) return

    try {
      setError(null)
      setSuccess(null)
      setDeletingUserId(targetUser.user_id)

      const token = await getSessionToken()
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: targetUser.user_id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }

      setUsers((current) => current.filter((user) => user.user_id !== targetUser.user_id))
      setSuccess(`User ${targetUser.name || targetUser.email} berhasil dihapus`)
      await fetchUsers()
    } catch (error: any) {
      setError(error.message || 'Failed to delete user')
    } finally {
      setDeletingUserId(null)
    }
  }

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesSearch =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword)

      return matchesRole && matchesSearch
    })
  }, [roleFilter, searchTerm, users])

  const adminCount = users.filter((user) => user.role === 'admin').length
  const employeeCount = users.filter((user) => user.role === 'karyawan').length
  const assignedGeofenceCount = users.filter((user) => Boolean(user.geofence)).length
  const errorHelp = error ? getUserErrorHelp(error) : null
  const detailStats = useMemo(() => {
    const total = detailRecords.length
    const valid = detailRecords.filter((record) => record.status === 'valid').length
    const invalid = detailRecords.filter((record) => record.status === 'invalid').length

    return {
      total,
      valid,
      invalid,
      validPercent: total > 0 ? (valid / total) * 100 : 0,
      invalidPercent: total > 0 ? (invalid / total) * 100 : 0,
    }
  }, [detailRecords])
  const selectedDisplayName = selectedUser
    ? selectedUser.name || selectedUser.email.split('@')[0]
    : ''

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 border-b border-slate-200 bg-slate-50 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
              Directory
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Kelola User</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Tambahkan admin atau karyawan, atur geofence, dan jaga akses dashboard tetap rapi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextShowForm = !showForm || Boolean(editingUserId)
              setShowForm(nextShowForm)
              resetDetail()
              setError(null)
              setSuccess(null)
              resetForm()
            }}
            className="btn-primary h-11 w-full sm:w-auto"
          >
            {showForm && !editingUserId ? 'Tutup Form' : 'Tambah Pengguna'}
          </button>
        </div>

        <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Total</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{users.length}</p>
            <p className="mt-1 text-sm text-slate-500">akun terdaftar</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Admin</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">{adminCount}</p>
            <p className="mt-1 text-sm text-slate-500">operator dashboard</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
              Karyawan
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">{employeeCount}</p>
            <p className="mt-1 text-sm text-slate-500">pengguna absensi</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">
              Geofence
            </p>
            <p className="mt-2 text-3xl font-bold text-violet-950">{assignedGeofenceCount}</p>
            <p className="mt-1 text-sm text-slate-500">akun sudah punya lokasi</p>
          </div>
        </div>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div className="panel-enter rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-rose-700">
                Gagal menyimpan pengguna
              </p>
              <p className="mt-2 text-sm font-semibold leading-6">{error}</p>
              {errorHelp && <p className="mt-2 text-sm leading-6 text-rose-800">{errorHelp}</p>}
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-100"
              aria-label="Tutup pesan error"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="panel-enter overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 border-b border-slate-100 bg-slate-50 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-lg font-bold text-teal-800 ring-1 ring-teal-100">
                {getInitials(selectedDisplayName, selectedUser.email)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                  Detail Karyawan
                </p>
                <h3 className="mt-1 truncate text-xl font-bold text-slate-950">
                  {selectedDisplayName}
                </h3>
                <p className="mt-1 break-all text-sm text-slate-500">{selectedUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetDetail()
              }}
              className="btn-secondary h-10 w-full sm:w-auto"
            >
              Tutup Detail
            </button>
          </div>

          <div className="grid gap-0 lg:grid-cols-[18rem_1fr]">
            <aside className="space-y-4 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Data Pribadi
                </p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-500">Nama</dt>
                    <dd className="mt-1 font-bold text-slate-950">{selectedDisplayName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Email</dt>
                    <dd className="mt-1 break-all font-semibold text-slate-800">
                      {selectedUser.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Role</dt>
                    <dd className="mt-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                          selectedUser.role === 'admin'
                            ? 'bg-blue-50 text-blue-700 ring-blue-100'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        }`}
                      >
                        {selectedUser.role === 'admin' ? 'Admin' : 'Karyawan'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Bergabung</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {formatDate(selectedUser.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Geofence</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {selectedUser.geofence ? selectedUser.geofence.location_name : '-'}
                    </dd>
                    {selectedUser.geofence && (
                      <p className="mt-1 text-xs text-slate-500">
                        Radius {Number(selectedUser.geofence.radius)}m
                      </p>
                    )}
                  </div>
                </dl>
              </div>

              <div>
                <label
                  htmlFor="detailMonth"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Bulan laporan
                </label>
                <input
                  id="detailMonth"
                  type="month"
                  value={detailMonth}
                  onChange={(e) => setDetailMonth(e.target.value || getCurrentMonthValue())}
                  className="input-base"
                  disabled={selectedUser.role !== 'karyawan'}
                />
              </div>
            </aside>

            <div className="space-y-5 p-5">
              {selectedUser.role !== 'karyawan' ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
                  Akun admin tidak memiliki ringkasan absensi karyawan.
                </div>
              ) : detailError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                  {detailError}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Total Absensi
                      </p>
                      <p className="mt-2 text-3xl font-bold text-slate-950">
                        {detailLoading ? '-' : detailStats.total}
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                        Valid
                      </p>
                      <p className="mt-2 text-3xl font-bold text-emerald-950">
                        {detailLoading ? '-' : detailStats.valid}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {formatPercent(detailStats.validPercent)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">
                        Tidak Valid
                      </p>
                      <p className="mt-2 text-3xl font-bold text-rose-950">
                        {detailLoading ? '-' : detailStats.invalid}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        {formatPercent(detailStats.invalidPercent)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-950">Persentase Bulanan</p>
                      <p className="text-sm font-semibold text-slate-500">
                        {detailLoading
                          ? 'Memuat...'
                          : `${detailStats.valid} valid / ${detailStats.total} total`}
                      </p>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${detailStats.validPercent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
                      <span>Valid {formatPercent(detailStats.validPercent)}</span>
                      <span>Tidak valid {formatPercent(detailStats.invalidPercent)}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-bold text-slate-950">Riwayat Absensi Bulan Ini</p>
                    </div>
                    {detailLoading ? (
                      <div className="px-4 py-8 text-center">
                        <div className="spinner mx-auto h-8 w-8" />
                      </div>
                    ) : detailRecords.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                        Belum ada data absensi pada bulan ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {detailRecords.slice(0, 8).map((record) => (
                          <div
                            key={record.attendance_id}
                            className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-950">
                                {formatDateTime(record.check_in_time)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Check-out: {formatDateTime(record.check_out_time)}
                              </p>
                            </div>
                            <span
                              className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                                record.status === 'valid'
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                                  : 'bg-rose-50 text-rose-700 ring-rose-100'
                              }`}
                            >
                              {record.status === 'valid' ? 'Valid' : 'Tidak valid'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="panel-enter rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-950">
              {editingUserId ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {editingUserId
                ? 'Perubahan akan disinkronkan ke Supabase Auth dan profil aplikasi.'
                : 'Akun dibuat di Supabase Auth dan langsung disinkronkan ke profil aplikasi.'}
            </p>
          </div>

          <form onSubmit={handleSubmitUser} className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-base"
                  placeholder="Agung Pratama"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-base"
                  placeholder="agung@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <input
                  type="text"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-base"
                  placeholder={editingUserId ? 'Kosongkan jika tidak diganti' : 'Minimal 6 karakter'}
                />
              </div>

              <div>
                <label htmlFor="role" className="mb-2 block text-sm font-semibold text-slate-700">
                  Role
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserRole,
                      geofenceId:
                        e.target.value === 'karyawan'
                          ? formData.geofenceId || geofences[0]?.geofence_id || ''
                          : '',
                    })
                  }
                  className="input-base"
                >
                  <option value="karyawan">Karyawan</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="geofence"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Lokasi dan Radius Geofence
                </label>
                <select
                  id="geofence"
                  value={formData.geofenceId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      geofenceId: e.target.value,
                    })
                  }
                  className="input-base"
                  disabled={formData.role === 'admin' || geofences.length === 0}
                >
                  {geofences.length === 0 ? (
                    <option value="">Belum ada data geofence</option>
                  ) : (
                    geofences.map((geofence) => (
                      <option key={geofence.geofence_id} value={geofence.geofence_id}>
                        {geofence.location_name} - Radius {Number(geofence.radius)}m
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Admin tidak membutuhkan geofence. Karyawan wajib memiliki lokasi absensi aktif.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="btn-secondary"
                disabled={saving}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : editingUserId ? 'Update User' : 'Simpan User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor="searchUser" className="sr-only">
              Search user
            </label>
            <input
              id="searchUser"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base"
              placeholder="Cari nama atau email"
            />
          </div>
          <div>
            <label htmlFor="roleFilter" className="sr-only">
              Filter role
            </label>
            <select
              id="roleFilter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'karyawan')}
              className="input-base"
            >
              <option value="all">Semua role</option>
              <option value="admin">Admin</option>
              <option value="karyawan">Karyawan</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-950">Daftar Pengguna</h3>
          <p className="mt-1 text-sm text-slate-500">
            Menampilkan {filteredUsers.length} dari {users.length} user.
          </p>
        </div>

        <div className="block md:hidden">
          {loading ? (
            <div className="px-6 py-10 text-center">
              <div className="spinner mx-auto h-8 w-8" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
                    />
                  </svg>
                </div>
                <p className="font-bold text-slate-950">User tidak ditemukan</p>
                <p className="mt-1 text-sm text-slate-500">
                  Coba kata kunci atau filter role yang berbeda.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const displayName = user.name || user.email.split('@')[0]
                const isDeleting = deletingUserId === user.user_id

                return (
                  <article key={user.user_id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                        {getInitials(displayName, user.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-950">{displayName}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                              user.role === 'admin'
                                ? 'bg-blue-50 text-blue-700 ring-blue-100'
                                : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Karyawan'}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Joined
                        </p>
                        <p className="mt-1 font-semibold text-slate-700">
                          {formatDate(user.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Geofence
                        </p>
                        <p className="mt-1 truncate font-semibold text-slate-700">
                          {user.geofence ? user.geofence.location_name : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openUserDetail(user)}
                        className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-bold text-teal-700 transition-colors hover:bg-teal-50"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditUser(user)}
                        disabled={isDeleting || saving}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user)}
                        disabled={isDeleting}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeleting ? 'Menghapus...' : 'Delete'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Geofence
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <div className="spinner mx-auto h-8 w-8" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
                          />
                        </svg>
                      </div>
                      <p className="font-bold text-slate-950">User tidak ditemukan</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Coba kata kunci atau filter role yang berbeda.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const displayName = user.name || user.email.split('@')[0]
                  const isDeleting = deletingUserId === user.user_id

                  return (
                    <tr key={user.user_id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                            {getInitials(displayName, user.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{displayName}</p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                            user.role === 'admin'
                              ? 'bg-blue-50 text-blue-700 ring-blue-100'
                              : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                          }`}
                        >
                          {user.role === 'admin' ? 'Admin' : 'Karyawan'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {user.geofence ? (
                          <div>
                            <p className="font-semibold text-slate-950">
                              {user.geofence.location_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Radius {Number(user.geofence.radius)}m
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <button
                          type="button"
                          onClick={() => openUserDetail(user)}
                          className="mr-2 rounded-lg px-3 py-2 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditUser(user)}
                          disabled={isDeleting || saving}
                          className="mr-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={isDeleting}
                          className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? 'Menghapus...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
