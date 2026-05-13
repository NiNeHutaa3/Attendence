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
    <html lang="en" data-scroll-behavior="smooth">
      <body className="bg-[#0F172A] text-[#E2E8F0] font-inter antialiased">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  )
}
