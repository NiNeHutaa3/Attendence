'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { verifyGeofenceLocation, type VerifiedLocationResult } from '@/utils/geolocation'
import {
  startCamera,
  capturePhoto,
  stopMediaStream,
  uploadPhoto,
  getIPAddress,
  getUserAgent,
} from '@/utils/camera'
import type { Attendance } from '@/types'

const MapComponent = dynamic(() => import('@/components/common/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-500">
      Loading map...
    </div>
  ),
})

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const GEOFENCE_LAT = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LAT, -6.2088)
const GEOFENCE_LNG = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LNG, 106.8456)
const GEOFENCE_RADIUS = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS, 100)

type ActiveGeofence = {
  locationName: string
  lat: number
  lng: number
  radius: number
}

const DEFAULT_GEOFENCE: ActiveGeofence = {
  locationName: 'Default Office',
  lat: GEOFENCE_LAT,
  lng: GEOFENCE_LNG,
  radius: GEOFENCE_RADIUS,
}

type CheckInState = 'idle' | 'getting-location' | 'capturing-photo' | 'uploading' | 'success' | 'error'
type AttendanceAction = 'checkin' | 'checkout'

const getSupabaseMessage = (error: any, fallback: string) =>
  error?.message || error?.error_description || fallback

const ensureUserProfile = async (user: NonNullable<ReturnType<typeof useAuth>['user']>) => {
  const { data: existingProfile, error: profileError } = await supabase
    .from('users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    throw new Error(
      getSupabaseMessage(
        profileError,
        `Gagal mengecek profil user. UID login saat ini: ${user.id}.`
      )
    )
  }

  if (existingProfile) {
    return
  }

  const { error: insertProfileError } = await supabase.from('users').insert({
    user_id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email.split('@')[0],
    role: user.user_metadata?.role === 'admin' ? 'admin' : 'karyawan',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (insertProfileError) {
    throw new Error(
      getSupabaseMessage(
        insertProfileError,
        `Gagal membuat profil user. Tambahkan manual di public.users dengan user_id: ${user.id}.`
      )
    )
  }
}

export const CheckInComponent = () => {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [state, setState] = useState<CheckInState>('idle')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [locationVerification, setLocationVerification] = useState<VerifiedLocationResult | null>(
    null
  )
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null)
  const [activeGeofence, setActiveGeofence] = useState<ActiveGeofence>(DEFAULT_GEOFENCE)
  const [attendanceAction, setAttendanceAction] = useState<AttendanceAction>('checkin')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkTodayAttendance = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        const today = new Date().toDateString()
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', new Date(today).toISOString())
          .lte('created_at', new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle()

        if (error) {
          throw error
        }

        setTodayAttendance(data)
      } catch (error) {
        console.error('Error checking today attendance:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkTodayAttendance()
  }, [user])

  useEffect(() => {
    const fetchUserGeofence = async () => {
      if (!user) {
        setActiveGeofence(DEFAULT_GEOFENCE)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('geofence:geofence_id(location_name, latitude_center, longitude_center, radius)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.warn('Could not load user geofence, falling back to env geofence:', error)
        setActiveGeofence(DEFAULT_GEOFENCE)
        return
      }

      const geofence = Array.isArray(data?.geofence) ? data.geofence[0] : data?.geofence

      if (!geofence) {
        setActiveGeofence(DEFAULT_GEOFENCE)
        return
      }

      setActiveGeofence({
        locationName: geofence.location_name,
        lat: Number(geofence.latitude_center),
        lng: Number(geofence.longitude_center),
        radius: Number(geofence.radius),
      })
    }

    fetchUserGeofence()
  }, [user])

  useEffect(() => {
    if (!photoBlob) {
      setPhotoPreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(photoBlob)
    setPhotoPreviewUrl(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [photoBlob])

  const startCameraCapture = async () => {
    try {
      setError(null)
      setCameraActive(true)
      const stream = await startCamera()
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err: any) {
      setError(err.message || 'Failed to access camera')
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const takePhoto = async () => {
    if (!videoRef.current) return

    try {
      setError(null)
      setState('capturing-photo')
      const blob = await capturePhoto(videoRef.current)
      setPhotoBlob(blob)
      stopCamera()
      setState('idle')
    } catch (err: any) {
      setError(err.message || 'Failed to capture photo')
      setState('error')
    }
  }

  const resetAttendanceSteps = () => {
    setState('idle')
    setPhotoBlob(null)
    setDistance(null)
    setIsValid(null)
    setUserLocation(null)
    setLocationVerification(null)
  }

  const saveAttendanceEvidence = async (
    attendanceId: string,
    capturedAt: string,
    eventType: AttendanceAction
  ) => {
    if (!userLocation || !photoBlob || isValid === null || distance === null) {
      throw new Error('Data lokasi atau foto belum lengkap')
    }

    const photoUrl = await uploadPhoto(photoBlob, `${attendanceId}-${eventType}`, supabase)
    const ipAddress = await getIPAddress()
    const userAgent = getUserAgent()

    const { error: photoError } = await supabase.from('photo_attendance').insert({
      attendance_id: attendanceId,
      photo_url: photoUrl,
      event_type: eventType,
      captured_at: capturedAt,
      created_at: capturedAt,
    })

    if (photoError) {
      throw new Error(
        getSupabaseMessage(
          photoError,
          'Gagal menyimpan data foto. Pastikan tabel photo_attendance dan policy insert sudah benar.'
        )
      )
    }

    const { error: locationError } = await supabase.from('location_log').insert({
      attendance_id: attendanceId,
      event_type: eventType,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      distance_from_center: distance,
      is_within_geofence: isValid,
      created_at: capturedAt,
    })

    if (locationError) {
      throw new Error(
        getSupabaseMessage(
          locationError,
          'Gagal menyimpan lokasi. Pastikan tabel location_log dan policy insert sudah benar.'
        )
      )
    }

    const { error: accessError } = await supabase.from('access_log').insert({
      attendance_id: attendanceId,
      event_type: eventType,
      user_agent: userAgent,
      ip_address: ipAddress,
      is_vpn: false,
      created_at: capturedAt,
    })

    if (accessError) {
      throw new Error(
        getSupabaseMessage(
          accessError,
          'Gagal menyimpan access log. Pastikan tabel access_log dan policy insert sudah benar.'
        )
      )
    }
  }

  const handleSubmitAttendance = async () => {
    if (!user || !userLocation || !photoBlob || isValid === null || distance === null) {
      setError('Missing required data')
      return
    }

    setState('uploading')
    setError(null)

    try {
      const now = new Date().toISOString()
      await ensureUserProfile(user)

      if (attendanceAction === 'checkout') {
        if (!todayAttendance || todayAttendance.check_out_time) {
          throw new Error('Data check-in hari ini tidak ditemukan atau sudah check-out.')
        }

        await saveAttendanceEvidence(todayAttendance.attendance_id, now, 'checkout')

        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            check_out_time: now,
            updated_at: now,
          })
          .eq('attendance_id', todayAttendance.attendance_id)

        if (updateError) {
          throw updateError
        }

        setState('success')
        setTodayAttendance({
          ...todayAttendance,
          check_out_time: now,
          updated_at: now,
        })

        setTimeout(() => {
          resetAttendanceSteps()
          setAttendanceAction('checkin')
        }, 3000)
        return
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          user_id: user.id,
          check_in_time: now,
          status: isValid ? 'valid' : 'invalid',
          created_at: now,
        })
        .select('attendance_id, user_id, check_in_time, check_out_time, status, created_at')
        .single()

      if (attendanceError || !attendanceData) {
        throw new Error(
          getSupabaseMessage(
            attendanceError,
            `Gagal membuat data attendance. Pastikan user_id ini ada di tabel public.users: ${user.id}.`
          )
        )
      }

      const attendanceId = attendanceData.attendance_id
      await saveAttendanceEvidence(attendanceId, now, 'checkin')

      setState('success')
      setTodayAttendance(attendanceData)

      setTimeout(() => {
        resetAttendanceSteps()
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan absensi')
      setState('error')
    }
  }

  const handleGetLocation = async () => {
    setState('getting-location')
    setError(null)

    try {
      const verification = await verifyGeofenceLocation(
        activeGeofence.lat,
        activeGeofence.lng,
        activeGeofence.radius
      )
      const lat = verification.lat
      const lng = verification.lng

      setUserLocation({ lat, lng })
      setDistance(verification.distance)
      setIsValid(verification.isValid)
      setLocationVerification(verification)
      setState('idle')
    } catch (err: any) {
      setError(err.message || 'Failed to get location')
      setState('error')
    }
  }

  const startCheckOutFlow = () => {
    setAttendanceAction('checkout')
    setError(null)
    resetAttendanceSteps()
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="font-medium text-slate-500">Memuat status absensi...</p>
      </div>
    )
  }

  const isBusy =
    state === 'getting-location' || state === 'capturing-photo' || state === 'uploading'
  const isCheckOutFlow =
    attendanceAction === 'checkout' && Boolean(todayAttendance && !todayAttendance.check_out_time)
  const actionLabel = isCheckOutFlow ? 'check-out' : 'check-in'
  const currentStep =
    todayAttendance && !isCheckOutFlow ? 4 : photoBlob ? 4 : cameraActive ? 3 : userLocation ? 2 : 1
  const stepItems = ['Lokasi', 'Validasi', 'Foto', 'Kirim']
  const isOutsideGeofence = locationVerification?.isWithinGeofence === false
  const invalidLocationTitle = isOutsideGeofence
    ? 'Lokasi di luar radius kantor'
    : 'Kualitas GPS perlu diperiksa'
  const invalidLocationMessage = isOutsideGeofence
    ? `Posisi kamu berada di luar radius ${activeGeofence.radius} m dari ${activeGeofence.locationName}. Silakan mendekat ke area kantor dan ambil ulang lokasi.`
    : 'Lokasi ditolak karena kualitas GPS terdeteksi tidak stabil atau mencurigakan. Matikan aplikasi pemalsuan lokasi, pastikan GPS aktif, lalu coba lagi.'

  return (
    <section className="space-y-4 lg:space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
              Proses Absensi
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 lg:text-2xl">
              {todayAttendance && !isCheckOutFlow
                ? 'Absensi hari ini tercatat'
                : `Mulai ${actionLabel}`}
            </h2>
          </div>

          <div className="hidden grid-cols-4 gap-2 lg:grid">
            {stepItems.map((item, index) => {
              const step = index + 1
              const done = currentStep > step
              const active = currentStep === step

              return (
                <div
                  key={item}
                  className={`min-w-[5.25rem] rounded-lg border px-3 py-2 text-center ${
                    done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : active
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <p className="text-xs font-bold">{step}</p>
                  <p className="mt-1 text-xs font-semibold">{item}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {state === 'success' && (
        <div className="alert-success">
          {attendanceAction === 'checkout' ? 'Check-out berhasil.' : 'Check-in berhasil.'}
        </div>
      )}

      {todayAttendance && !isCheckOutFlow ? (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
            <div className="p-5 sm:p-8">
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                {todayAttendance.status}
              </span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 lg:text-3xl">
                Kamu sudah check-in hari ini
              </h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Check-in
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950">
                    {new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Check-out
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950">
                    {todayAttendance.check_out_time
                      ? new Date(todayAttendance.check_out_time).toLocaleTimeString('id-ID')
                      : 'Belum check-out'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center border-t border-slate-100 bg-emerald-50 p-6 lg:border-l lg:border-t-0">
              {!todayAttendance.check_out_time ? (
                <button
                  onClick={startCheckOutFlow}
                  disabled={isBusy}
                  className="btn-primary w-full"
                >
                  Mulai Check Out
                </button>
              ) : (
                <p className="text-center text-sm font-bold text-emerald-800">
                  Absensi hari ini sudah lengkap.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : photoBlob ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
            <div className="p-5 sm:p-6">
              <p className="mb-3 text-sm font-bold text-slate-700">Preview Foto</p>
              {photoPreviewUrl && (
                <img
                  src={photoPreviewUrl}
                  alt="Photo preview"
                  className="h-80 w-full rounded-lg object-cover lg:h-[24rem]"
                />
              )}
            </div>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0">
              <h3 className="text-xl font-bold text-slate-950">Foto sudah siap</h3>
              <p className="text-sm leading-6 text-slate-500">
                Jika foto sudah jelas, kirim {actionLabel}. Jika belum, ambil ulang foto.
              </p>
              <button
                onClick={handleSubmitAttendance}
                className="btn-primary w-full"
                disabled={isBusy}
              >
                {state === 'uploading'
                  ? 'Mengirim...'
                  : isCheckOutFlow
                    ? 'Kirim Check Out'
                    : 'Kirim Absensi'}
              </button>
              <button
                onClick={() => {
                  setPhotoBlob(null)
                  startCameraCapture()
                }}
                className="btn-secondary w-full"
                disabled={isBusy}
              >
                Ambil Ulang
              </button>
              <button
                onClick={() => {
                  setPhotoBlob(null)
                  if (isCheckOutFlow) {
                    setAttendanceAction('checkin')
                    resetAttendanceSteps()
                  }
                }}
                className="btn-secondary w-full"
                disabled={isBusy}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      ) : cameraActive ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                  Kamera
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950 lg:text-2xl">Ambil bukti foto</h3>
              </div>
              <button onClick={stopCamera} className="btn-secondary min-h-10 px-3 text-sm">
                Tutup Kamera
              </button>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-80 w-full rounded-lg bg-black object-cover lg:h-[28rem]"
            />
            <button onClick={takePhoto} className="btn-primary mt-4 w-full" disabled={isBusy}>
              {state === 'capturing-photo' ? 'Mengambil foto...' : 'Ambil Foto'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100 lg:mb-6 lg:h-14 lg:w-14">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 11c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm0 10s7-4.438 7-11a7 7 0 10-14 0c0 6.562 7 11 7 11z"
                  />
                </svg>
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:text-sm">
                Langkah berikutnya
              </p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 lg:text-3xl">
                {!userLocation
                  ? `Verifikasi lokasi ${actionLabel}`
                  : isValid
                    ? 'Lokasi valid, lanjut foto'
                    : invalidLocationTitle}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                {!userLocation
                  ? `Tekan tombol untuk mengecek lokasi sebelum ${actionLabel}.`
                  : isValid
                    ? 'Posisi kamu berada di area yang diizinkan. Lanjutkan dengan mengambil foto kehadiran.'
                    : invalidLocationMessage}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {!userLocation ? (
                  <button
  onClick={handleGetLocation}
  disabled={isBusy}
  className={`
    group relative flex flex-1 items-center justify-center gap-3
    overflow-hidden rounded-2xl
    px-5 py-4
    text-sm font-semibold
    transition-all duration-300

    ${
      isBusy
        ? 'cursor-not-allowed bg-slate-200 text-slate-500'
        : 'bg-gradient-to-r from-teal-700 to-teal-600 text-white shadow-lg shadow-teal-500/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-500/30'
    }
  `}
>

  {/* ICON */}
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 11c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm0 10s7-4.438 7-11a7 7 0 10-14 0c0 6.562 7 11 7 11z"
      />
    </svg>
  </div>

  {/* TEXT */}
  <div className="flex flex-col items-start text-left">

    <span className="text-sm font-semibold">
      {state === 'getting-location'
        ? 'Mengambil lokasi...'
        : 'Ambil Lokasi'}
    </span>

    <span
      className={`
        text-xs
        ${isBusy ? 'text-slate-400' : 'text-teal-100'}
      `}
    >
      Validasi area kantor
    </span>

  </div>

</button>
                ) : isValid ? (
                  <button
  onClick={startCameraCapture}
  disabled={isBusy}
  className={`
    group flex flex-1 items-center justify-center gap-3
    rounded-2xl
    bg-gradient-to-r from-emerald-600 to-emerald-500
    px-5 py-4
    text-white
    shadow-lg shadow-emerald-500/20
    transition-all duration-300

    hover:-translate-y-0.5
    hover:shadow-xl hover:shadow-emerald-500/30

    disabled:cursor-not-allowed
    disabled:opacity-60
  `}
>

  {/* ICON */}
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">

    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7h4l2-2h6l2 2h4v12H3V7zm9 10a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>

  </div>

  {/* TEXT */}
      <div className="flex flex-col items-start text-left">

    <span className="text-sm font-semibold">
      Buka Kamera
    </span>

    <span className="text-xs text-emerald-100">
      Ambil foto {actionLabel}
    </span>

  </div>

</button>
                ) : (
                  <button onClick={handleGetLocation} disabled={isBusy} className="btn-primary flex-1">
                    Ambil Ulang Lokasi
                  </button>
                )}

                {userLocation && (
                  <button
  onClick={() => {
    setUserLocation(null)
    setDistance(null)
    setIsValid(null)
    setLocationVerification(null)
  }}
  disabled={isBusy}
  className={`
    flex flex-1 items-center justify-center gap-3
    rounded-2xl
    border border-slate-300
    bg-white
    px-5 py-4
    text-slate-700
    transition-all duration-300

    hover:bg-slate-50
    hover:border-slate-400

    disabled:cursor-not-allowed
    disabled:opacity-60
  `}
>

  {/* ICON */}
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">

    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356-2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.582 15m13.837 0H15"
      />
    </svg>

  </div>

  {/* TEXT */}
  <div className="flex flex-col items-start text-left">

    <span className="text-sm font-semibold">
      Reset
    </span>

    <span className="text-xs text-slate-500">
      Ulangi proses
    </span>

  </div>

</button>
                )}
              </div>
            </div>

            {userLocation && (
              <div className="hidden border-t border-slate-100 p-5 sm:p-6 lg:block">
                <MapComponent
                  userLat={userLocation.lat}
                  userLng={userLocation.lng}
                  centerLat={activeGeofence.lat}
                  centerLng={activeGeofence.lng}
                  radius={activeGeofence.radius}
                />
              </div>
            )}
          </div>

          <aside className="hidden space-y-5 lg:block">
            <div
              className={`rounded-2xl border p-5 ${
                userLocation
                  ? isValid
                    ? 'border-emerald-100 bg-emerald-50'
                    : 'border-rose-100 bg-rose-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-[0.14em] ${
                  userLocation
                    ? isValid
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                    : 'text-slate-400'
                }`}
              >
                Status Lokasi
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {!userLocation ? 'Belum dicek' : isValid ? 'Valid' : 'Tidak valid'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {!userLocation
                  ? 'Ambil lokasi untuk mulai.'
                  : isValid
                    ? 'Lokasi lolos validasi radius dan akurasi.'
                    : isOutsideGeofence
                      ? `Kamu berada di luar radius ${activeGeofence.radius} m dari area kantor.`
                      : 'Lokasi ditolak karena kualitas GPS mencurigakan.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Jarak ke {activeGeofence.locationName}
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {distance ? `${distance.toFixed(1)} m` : '--'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Radius kantor: {activeGeofence.radius} m
              </p>
              {locationVerification && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-600">Akurasi GPS</span>
                    <span className="font-bold text-slate-950">
                      {locationVerification.accuracy.toFixed(1)} m
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-600">Sampel</span>
                    <span className="font-bold text-slate-950">
                      {locationVerification.samples.length} titik
                    </span>
                  </div>
                  {locationVerification.issues.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {locationVerification.issues.map((issue) => (
                        <p key={issue} className="text-xs leading-5 text-rose-700">
                          {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
