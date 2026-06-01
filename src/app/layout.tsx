import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Web Absensi - Attendance System',
  description: 'Attendance tracking system with geolocation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body className="bg-slate-50 text-slate-800 font-inter antialiased">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  )
}
