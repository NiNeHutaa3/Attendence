import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f8f7]">

      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 hidden lg:block">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-teal-200/50 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 md:px-12 lg:px-20 lg:py-10">

        <div className="grid w-full items-center gap-20 lg:grid-cols-2">

          {/* LEFT CONTENT */}
          <section className="hidden lg:block">
            <div className="max-w-xl">

              {/* TOP BADGE */}
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-teal-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
                <div className="h-2 w-2 rounded-full bg-teal-600" />
                <span className="text-sm font-medium text-slate-700">
                  Smart Attendance Platform
                </span>
              </div>

              {/* HEADING */}
              <div className="space-y-6">

                <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 lg:text-6xl">
                  Kehadiran tercatat. Tim bekerja lebih tenang.
                </h1>

                <p className="max-w-lg text-lg leading-8 text-slate-600">
                  Check-in berbasis lokasi, dokumentasi foto, dan laporan harian dalam satu ruang kerja yang sederhana dan mudah dipahami.
                </p>

              </div>

              {/* STATS */}

            </div>
          </section>

          {/* RIGHT */}
          <section className="flex justify-center lg:justify-end">

            {/* FORM CONTAINER */}
            <div className="relative w-full max-w-md">

              {/* GLOW */}
              <div className="absolute inset-0 hidden rounded-3xl bg-teal-500/10 blur-2xl lg:block" />

              {/* CARD */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:rounded-3xl lg:border-white/60 lg:bg-white/80 lg:p-8 lg:shadow-2xl lg:backdrop-blur-xl">

                {/* HEADER */}
                <div className="mb-6 lg:mb-8">

                  

                  <div className="mb-5 flex items-center gap-3 lg:hidden">
                    <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white">
                      A
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">
                        Web Absensi
                      </p>
                      <p className="text-xs text-slate-400">
                        Portal kehadiran
                      </p>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    Selamat datang
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Masuk untuk mencatat kehadiran atau mengelola data absensi tim.
                  </p>

                </div>

                <LoginForm />

              </div>

            </div>

          </section>

        </div>
      </div>
    </main>
  )
}
