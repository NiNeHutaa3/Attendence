'use client'

import Link from 'next/link'

export const RegisterForm = () => {
  return (
    <div className="w-full">
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Registrasi ditutup</h2>
        <p className="text-sm leading-6 text-slate-500">
          Akun karyawan sekarang dibuat oleh admin melalui dashboard. Hubungi admin untuk
          mendapatkan email dan password login.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Admin dapat memilih role, lokasi kerja, dan radius geofence saat membuat akun karyawan.
      </div>

      <Link
        href="/login"
        className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Kembali ke Login
      </Link>
    </div>
  )
}
