'use client'

import Link from 'next/link'

export const RegisterForm = () => {
  return (
    <div className="w-full">
      <p className="mb-5 text-sm leading-6 text-slate-500">
        Akun dibuat oleh admin. Gunakan email dan password yang sudah diberikan.
      </p>

      <Link
        href="/login"
        className="btn-primary mt-5 w-full text-sm"
      >
        Kembali ke Login
      </Link>
    </div>
  )
}
