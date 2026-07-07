import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-teal-50/40 px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-xl shadow-slate-200/70">
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg shadow-teal-700/15">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-950">Web Absensi</h1>
              <p className="text-xs text-slate-500">Login</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Masuk</h2>
        </div>

        <LoginForm />
      </section>
    </main>
  )
}
