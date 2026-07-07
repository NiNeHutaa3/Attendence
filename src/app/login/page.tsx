import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-teal-50/40 px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-xl shadow-slate-200/70">
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg shadow-teal-700/15">
              A
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
