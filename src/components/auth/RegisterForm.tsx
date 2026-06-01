'use client'

import Link from 'next/link'

export const RegisterForm = () => {
  return (
    <div className="w-full">
      <div className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Butuh akun untuk masuk?</h2>
        <p className="text-sm leading-6 text-slate-500">
          Akun karyawan sekarang dibuat oleh admin melalui dashboard. Hubungi admin untuk
          mendapatkan email dan password login.
        </p>
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
        Admin dapat memilih role, lokasi kerja, dan radius geofence saat membuat akun karyawan.
      </div>

      <Link
        href="/login"
        className="btn-primary mt-5 w-full text-sm"
      >
        Kembali ke Login
      </Link>
    </div>
  )
}
