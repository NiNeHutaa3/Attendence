'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import type { Geofence, User } from '@/types'

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

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([])
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
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

  useEffect(() => {
    fetchUsers()
    fetchGeofences()
  }, [])

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

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users')
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
    setFormData({
      email: '',
      name: '',
      role: 'karyawan',
      password: '',
      geofenceId: geofences[0]?.geofence_id || '',
    })
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.email || !formData.name || !formData.password) {
      setError('Nama, email, dan password wajib diisi')
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
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          geofenceId: formData.role === 'karyawan' ? formData.geofenceId : null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add user')
      }

      setSuccess(`User ${formData.name} berhasil ditambahkan`)
      resetForm()
      setShowForm(false)
      await fetchUsers()
    } catch (error: any) {
      setError(getAuthErrorMessage(error.message || 'Failed to add user'))
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

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-6 border-b border-slate-200 bg-slate-50 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
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
              setShowForm((current) => !current)
              setError(null)
              setSuccess(null)
              resetForm()
            }}
            className="btn-primary h-11"
          >
            {showForm ? 'Tutup Form' : 'Tambah Pengguna'}
          </button>
        </div>

        <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
        </div>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-950">Tambah Pengguna Baru</h3>
            <p className="mt-1 text-sm text-slate-500">
              Akun dibuat di Supabase Auth dan langsung disinkronkan ke profil aplikasi.
            </p>
          </div>

          <form onSubmit={handleAddUser} className="space-y-5 p-5">
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
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-base"
                  placeholder="Minimal 6 karakter"
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
                {saving ? 'Menyimpan...' : 'Simpan User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
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

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-950">Daftar Pengguna</h3>
          <p className="mt-1 text-sm text-slate-500">
            Menampilkan {filteredUsers.length} dari {users.length} user.
          </p>
        </div>

        <div className="overflow-x-auto">
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
