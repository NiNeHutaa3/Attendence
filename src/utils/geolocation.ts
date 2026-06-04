import { point, distance } from '@turf/turf'

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const DEFAULT_GEOFENCE_RADIUS = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS, 100)
const DEFAULT_GEOFENCE_LAT = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LAT, -6.2088)
const DEFAULT_GEOFENCE_LNG = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LNG, 106.8456)
const REQUIRED_LOCATION_SAMPLES = 3
const LOCATION_SAMPLE_INTERVAL_MS = 1200
const MAX_ACCEPTABLE_ACCURACY_METERS = 75
const MAX_GEOFENCE_EDGE_TOLERANCE_METERS = 25
const MAX_SAMPLE_SPREAD_METERS = 40
const MAX_REASONABLE_SPEED_MPS = 12

type LocationSample = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export type VerifiedLocationResult = {
  lat: number
  lng: number
  accuracy: number
  distance: number
  isValid: boolean
  isReliable: boolean
  isWithinGeofence: boolean
  issues: string[]
  samples: LocationSample[]
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    })
  })
}

const getLocationSample = async (): Promise<LocationSample> => {
  const position = await getCurrentPosition()
  const { latitude, longitude, accuracy } = position.coords

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracy)
  ) {
    throw new Error('Koordinat atau akurasi GPS tidak valid')
  }

  return {
    lat: latitude,
    lng: longitude,
    accuracy,
    timestamp: position.timestamp || Date.now(),
  }
}

export const calculateDistance = (
  userLat: number,
  userLng: number,
  centerLat: number = DEFAULT_GEOFENCE_LAT,
  centerLng: number = DEFAULT_GEOFENCE_LNG
): number => {
  if (
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLng) ||
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng)
  ) {
    throw new Error('Koordinat lokasi tidak valid')
  }

  const from = point([userLng, userLat])
  const to = point([centerLng, centerLat])
  const dist = distance(from, to, { units: 'meters' })
  return dist
}

export const verifyGeofenceLocation = async (
  centerLat: number = DEFAULT_GEOFENCE_LAT,
  centerLng: number = DEFAULT_GEOFENCE_LNG,
  radius: number = DEFAULT_GEOFENCE_RADIUS
): Promise<VerifiedLocationResult> => {
  const samples: LocationSample[] = []

  for (let index = 0; index < REQUIRED_LOCATION_SAMPLES; index += 1) {
    samples.push(await getLocationSample())

    if (index < REQUIRED_LOCATION_SAMPLES - 1) {
      await wait(LOCATION_SAMPLE_INTERVAL_MS)
    }
  }

  const bestSample = [...samples].sort((a, b) => a.accuracy - b.accuracy)[0]
  const qualityWarnings: string[] = []
  let maxSpread = 0
  let maxSpeed = 0

  samples.forEach((sample, index) => {
    if (sample.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      qualityWarnings.push(`Akurasi GPS rendah pada salah satu sampel (${Math.round(sample.accuracy)} m).`)
    }

    if (index === 0) {
      return
    }

    const previousSample = samples[index - 1]
    const sampleDistance = calculateDistance(
      previousSample.lat,
      previousSample.lng,
      sample.lat,
      sample.lng
    )
    const elapsedSeconds = Math.max(
      1,
      Math.abs(sample.timestamp - previousSample.timestamp) / 1000
    )
    const speed = sampleDistance / elapsedSeconds

    maxSpread = Math.max(maxSpread, sampleDistance)
    maxSpeed = Math.max(maxSpeed, speed)
  })

  if (maxSpread > MAX_SAMPLE_SPREAD_METERS) {
    qualityWarnings.push(`Sampel GPS berubah cukup jauh (${Math.round(maxSpread)} m).`)
  }

  if (maxSpeed > MAX_REASONABLE_SPEED_MPS) {
    qualityWarnings.push(`Perubahan lokasi antar sampel cukup cepat (${maxSpeed.toFixed(1)} m/s).`)
  }

  const dist = calculateDistance(bestSample.lat, bestSample.lng, centerLat, centerLng)

  const edgeTolerance = Math.min(MAX_GEOFENCE_EDGE_TOLERANCE_METERS, Math.max(10, radius * 0.2))
  const isWithinGeofence = dist <= radius + edgeTolerance

  const hasAccuracyIssue = bestSample.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS

  const geofenceIssues = isWithinGeofence
    ? []
    : [
        `Lokasi berada di luar area absensi. Jarak ${dist.toFixed(
          1
        )} m dari pusat, batas valid sekitar ${Math.round(radius + edgeTolerance)} m.`,
      ]

  const accuracyIssues = hasAccuracyIssue
    ? [
        `Akurasi GPS terlalu rendah (${Math.round(
          bestSample.accuracy
        )} m). Coba aktifkan mode akurasi tinggi dan ambil ulang lokasi.`,
      ]
    : []

  // Deduplicate issues supaya pesan yang sama (mis. “Akurasi GPS terlalu rendah ...”)
  // tidak muncul berulang saat kualitas/fokus validasi menghasilkan string identik.
  const issues = [...accuracyIssues, ...geofenceIssues, ...qualityWarnings]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

  const uniqueIssues = Array.from(new Set(issues))

  const isReliable = !hasAccuracyIssue
  const isValid = isReliable && isWithinGeofence


  return {

    lat: bestSample.lat,
    lng: bestSample.lng,
    accuracy: bestSample.accuracy,
    distance: dist,
    isValid,
    isReliable,
    isWithinGeofence,
    issues: uniqueIssues,
    samples,
  }
}
