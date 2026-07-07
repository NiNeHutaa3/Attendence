import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-teal-50/40 px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-xl shadow-slate-200/70">
        <div className="mb-6">
          <div className="brand-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg shadow-teal-700/15">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Registrasi ditutup</h1>
          <p className="mt-2 text-sm text-slate-500">Hubungi admin untuk membuat akun.</p>
        </div>

        <RegisterForm />
      </section>
    </main>
  )
}
