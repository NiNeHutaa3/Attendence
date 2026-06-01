import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f8f7]">

      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0">

        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-teal-200/50 blur-3xl" />

        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-200/40 blur-3xl" />

      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 md:px-12 lg:px-20">

        <div className="grid w-full items-center gap-20 lg:grid-cols-2">

          {/* LEFT CONTENT */}
          <section className="hidden lg:block">

            <div className="max-w-xl">

              {/* BADGE */}
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-teal-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">

                <div className="h-2 w-2 rounded-full bg-teal-600" />

                <span className="text-sm font-medium text-slate-700">
                  Akses Karyawan
                </span>

              </div>

              {/* HEADING */}
              <div className="space-y-6">

                <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 lg:text-6xl">
                  Satu akses untuk proses kehadiran yang lebih tertata
                </h1>

                <p className="max-w-lg text-lg leading-8 text-slate-600">
                  Akun dibuat oleh admin agar lokasi kerja, radius absensi, dan hak akses setiap pengguna tetap terkelola.
                </p>

              </div>

              {/* FEATURE CARDS */}
              <div className="mt-12 grid grid-cols-3 gap-4">

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Akses
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Aman
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Lokasi
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Teratur
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm text-slate-500">
                    Bantuan
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Admin
                  </p>
                </div>

              </div>

            </div>

          </section>

          {/* RIGHT */}
          <section className="flex justify-center lg:justify-end">

            <div className="relative w-full max-w-md">

              {/* GLOW */}
              <div className="absolute inset-0 rounded-3xl bg-teal-500/10 blur-2xl" />

              {/* CARD */}
              <div className="relative rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">

                {/* HEADER */}
                <div className="mb-8">

                  <div className="brand-gradient mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-teal-500/20">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    Registrasi ditutup
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Akun baru dibuat dan dikelola langsung oleh admin perusahaan.
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
