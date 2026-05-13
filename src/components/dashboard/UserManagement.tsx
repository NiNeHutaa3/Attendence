'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import type { Geofence, User } from '@/types'

type UserRole = 'admin' | 'karyawan'

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([])
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
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
      const { data, error } = await supabase
        .from('users')
        .select('*, geofence:geofence_id(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.email || !formData.name || !formData.password) {
      setError('All fields are required')
      return
    }

    if (formData.role === 'karyawan' && !formData.geofenceId) {
      setError('Pilih lokasi dan radius geofence untuk karyawan')
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Admin session tidak ditemukan. Silakan login ulang.')
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

      setSuccess(`User ${formData.name} added successfully`)
      setFormData({
        email: '',
        name: '',
        role: 'karyawan',
        password: '',
        geofenceId: geofences[0]?.geofence_id || '',
      })
      setShowForm(false)
      fetchUsers()
    } catch (error: any) {
      setError(getAuthErrorMessage(error.message || 'Failed to add user'))
    }
  }

  const handleDeleteUser = async (userId: string) => {
if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return

    try {
      setError(null)

      const { error } = await supabase.from('users').delete().eq('user_id', userId)

      if (error) throw error

      setSuccess('User deleted successfully')
      fetchUsers()
    } catch (error: any) {
      setError(error.message || 'Failed to delete user')
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const keyword = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !keyword ||
      user.name.toLowerCase().includes(keyword) ||
      user.email.toLowerCase().includes(keyword)

    return matchesRole && matchesSearch
  })
  const adminCount = users.filter((user) => user.role === 'admin').length
  const employeeCount = users.filter((user) => user.role === 'karyawan').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add employee accounts and manage dashboard access.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setFormData({
              email: '',
              name: '',
              role: 'karyawan',
              password: '',
              geofenceId: geofences[0]?.geofence_id || '',
            })
          }}
className="btn-primary" 
        >
          {showForm ? 'Batal' : 'Tambah Pengguna'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Total</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{users.length}</p>
          <p className="mt-1 text-sm text-slate-500">registered users</p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Admin</p>
          <p className="mt-2 text-3xl font-bold text-blue-950">{adminCount}</p>
          <p className="mt-1 text-sm text-blue-700">dashboard operators</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
            Karyawan
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-950">{employeeCount}</p>
          <p className="mt-1 text-sm text-emerald-700">attendance users</p>
        </div>
      </div>

      {success && <div className="alert-success">{success}</div>}
      {error && <div className="alert-error">{error}</div>}

      {showForm && (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
    {/* Header */}
    <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
      <h2 className="text-xl font-bold text-slate-950">Tambah Pengguna</h2>
      <p className="mt-1 text-sm text-slate-500">
        Tambahkan akun admin atau karyawan baru ke sistem absensi.
      </p>
    </div>

    {/* Form */}
    <form onSubmit={handleAddUser} className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Full Name */}
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-semibold tracking-wide text-slate-700"
          >
            Full Name
          </label>

          <div className="relative">
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-semibold tracking-wide text-slate-700"
          >
            Email
          </label>

          <div className="relative">
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="user@example.com"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-semibold tracking-wide text-slate-700"
          >
            Password
          </label>

          <div className="relative">
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Minimum 6 characters"
            />
          </div>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label
            htmlFor="role"
            className="text-sm font-semibold tracking-wide text-slate-700"
          >
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="karyawan">Karyawan</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Geofence */}
        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor="geofence"
            className="text-sm font-semibold tracking-wide text-slate-700"
          >
            Lokasi dan Radius Geofence
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <select
              id="geofence"
              value={formData.geofenceId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  geofenceId: e.target.value,
                })
              }
              className="w-full bg-transparent text-sm text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                formData.role === 'admin' || geofences.length === 0
              }
            >
              {geofences.length === 0 ? (
                <option value="">Belum ada data geofence</option>
              ) : (
                geofences.map((geofence) => (
                  <option
                    key={geofence.geofence_id}
                    value={geofence.geofence_id}
                  >
                    {geofence.location_name} - {Number(geofence.radius)}m
                  </option>
                ))
              )}
            </select>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />
              <p>
                Admin tidak membutuhkan geofence. Karyawan wajib
                memiliki lokasi absensi aktif.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Button */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          className="btn-primary"
        >
          Add User
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
              placeholder="Search by name or email"
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
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="karyawan">Karyawan</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email
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
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="spinner mx-auto h-8 w-8" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
                          />
                        </svg>
                      </div>
                      <p className="font-bold text-slate-950">No users found</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try a different search keyword or role filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-950">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          user.role === 'admin'
                            ? 'bg-blue-50 text-blue-700 ring-blue-100'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        }`}
                      >
                        {user.role}
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
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => handleDeleteUser(user.user_id)}
                        className="text-xs font-bold text-rose-600 transition-colors hover:text-rose-700"
                      >
                        Delete
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
