import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100">

      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0">

        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-blue-200/40 blur-3xl" />

        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-indigo-200/40 blur-3xl" />

      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 md:px-12 lg:px-20">

        <div className="grid w-full items-center gap-20 lg:grid-cols-2">

          {/* LEFT CONTENT */}
          <section>

            <div className="max-w-xl">

              {/* BADGE */}
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-blue-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">

                <div className="h-2 w-2 rounded-full bg-blue-600" />

                <span className="text-sm font-medium text-slate-700">
                  Employee Registration
                </span>

              </div>

              {/* HEADING */}
              <div className="space-y-6">

                <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 lg:text-6xl">
                  Bangun sistem absensi yang lebih modern dan terstruktur
                </h1>

                <p className="max-w-lg text-lg leading-8 text-slate-600">
                  Daftarkan akun karyawan untuk mengakses dashboard absensi, validasi lokasi GPS, dan laporan aktivitas harian secara real-time.
                </p>

              </div>

              {/* FEATURE CARDS */}
              <div className="mt-12 grid grid-cols-3 gap-4">

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Setup
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Fast
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Security
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Secure
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Access
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Ready
                  </p>
                </div>

              </div>

            </div>

          </section>

          {/* RIGHT */}
          <section className="flex justify-center lg:justify-end">

            <div className="relative w-full max-w-md">

              {/* GLOW */}
              <div className="absolute inset-0 rounded-3xl bg-blue-500/10 blur-2xl" />

              {/* CARD */}
              <div className="relative rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">

                {/* HEADER */}
                <div className="mb-8">

                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                    +
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    Create account
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Lengkapi data untuk mulai menggunakan sistem absensi perusahaan.
                  </p>

                </div>

                <RegisterForm />

              </div>

            </div>

          </section>

        </div>
      </div>
    </main>
  )
}