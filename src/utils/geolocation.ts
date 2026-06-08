import { point, distance } from '@turf/turf'

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const DEFAULT_GEOFENCE_RADIUS = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS, 100)
const DEFAULT_GEOFENCE_LAT = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LAT, -6.2088)
const DEFAULT_GEOFENCE_LNG = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LNG, 106.8456)
const GPS_QUALITY_TARGET_METERS = 10
const MIN_RELIABLE_LOCATION_SAMPLES = 2
const TARGET_LOCATION_SAMPLES = 3
const MAX_LOCATION_CAPTURE_MS = 5000
const MAX_ACCEPTABLE_ACCURACY_METERS = parseEnvNumber(
  process.env.NEXT_PUBLIC_MAX_GPS_ACCURACY,
  75
)
const GEOFENCE_EDGE_TOLERANCE_METERS = 10
const MAX_SAMPLE_SPREAD_METERS = 25
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

const toLocationSample = (position: GeolocationPosition): LocationSample => {
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

const captureLocationSamples = (): Promise<LocationSample[]> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    const samples: LocationSample[] = []
    let watchId: number | null = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }

      if (samples.length === 0) {
        reject(new Error('Lokasi belum terbaca. Pastikan izin lokasi aktif lalu coba lagi.'))
        return
      }

      resolve(samples)
    }

    const timeoutId = window.setTimeout(finish, MAX_LOCATION_CAPTURE_MS)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        try {
          const sample = toLocationSample(position)
          samples.push(sample)

          const reliableSamples = samples.filter(
            (item) => item.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS
          )
          const hasEnoughSamples = samples.length >= TARGET_LOCATION_SAMPLES
          const hasEnoughReliableSamples = reliableSamples.length >= MIN_RELIABLE_LOCATION_SAMPLES
          const hasIdealSample = reliableSamples.some(
            (item) => item.accuracy <= GPS_QUALITY_TARGET_METERS
          )

          if (hasEnoughSamples && (hasEnoughReliableSamples || hasIdealSample)) {
            window.clearTimeout(timeoutId)
            finish()
          }
        } catch (error) {
          window.clearTimeout(timeoutId)
          finish()
        }
      },
      (error) => {
        window.clearTimeout(timeoutId)
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
        }
        reject(new Error(error.message || 'Gagal membaca lokasi perangkat'))
      },
      {
        enableHighAccuracy: true,
        timeout: MAX_LOCATION_CAPTURE_MS,
        maximumAge: 0,
      }
    )
  })
}

const getWeightedLocation = (samples: LocationSample[]): LocationSample => {
  const weights = samples.map((sample) => 1 / Math.max(sample.accuracy, 1))
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)

  if (totalWeight <= 0) {
    return [...samples].sort((a, b) => a.accuracy - b.accuracy)[0]
  }

  const weightedLat = samples.reduce(
    (total, sample, index) => total + sample.lat * weights[index],
    0
  )
  const weightedLng = samples.reduce(
    (total, sample, index) => total + sample.lng * weights[index],
    0
  )
  const bestAccuracy = Math.min(...samples.map((sample) => sample.accuracy))
  const latestTimestamp = Math.max(...samples.map((sample) => sample.timestamp))

  return {
    lat: weightedLat / totalWeight,
    lng: weightedLng / totalWeight,
    accuracy: bestAccuracy,
    timestamp: latestTimestamp,
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
  const samples = await captureLocationSamples()

  const reliableSamples = samples.filter(
    (sample) => sample.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS
  )
  const fallbackSample = [...samples].sort((a, b) => a.accuracy - b.accuracy)[0]
  const bestSample = getWeightedLocation(reliableSamples.length > 0 ? reliableSamples : [fallbackSample])
  const qualityWarnings: string[] = []
  let maxSpread = 0
  let maxSpeed = 0

  samples.forEach((sample, index) => {
    if (sample.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      qualityWarnings.push(`Akurasi GPS salah satu sampel melebihi batas aman ${MAX_ACCEPTABLE_ACCURACY_METERS} m (${Math.round(sample.accuracy)} m).`)
    } else if (sample.accuracy > GPS_QUALITY_TARGET_METERS) {
      qualityWarnings.push(`Akurasi GPS belum ideal (${Math.round(sample.accuracy)} m), tetapi masih dalam batas aman.`)
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

  const edgeTolerance = GEOFENCE_EDGE_TOLERANCE_METERS
  const isWithinGeofence = dist <= radius + edgeTolerance

  const hasAccuracyIssue = bestSample.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
  const hasTooFewReliableSamples = reliableSamples.length < MIN_RELIABLE_LOCATION_SAMPLES

  const geofenceIssues = isWithinGeofence
    ? []
    : [
        `Lokasi berada di luar area absensi. Jarak ${dist.toFixed(
          1
        )} m dari pusat, batas valid ${Math.round(radius)} m dengan toleransi +/-${edgeTolerance} m.`,
      ]

  const accuracyIssues = hasAccuracyIssue
    ? [
        `Akurasi GPS terlalu rendah (${Math.round(
          bestSample.accuracy
        )} m). Batas aman maksimal untuk absensi adalah ${MAX_ACCEPTABLE_ACCURACY_METERS} m.`,
      ]
    : []

  const sampleIssues = hasTooFewReliableSamples
    ? [
        `GPS belum stabil. Minimal ${MIN_RELIABLE_LOCATION_SAMPLES} sampel harus memiliki akurasi maksimal ${MAX_ACCEPTABLE_ACCURACY_METERS} m.`,
      ]
    : []

  const issues = [...accuracyIssues, ...sampleIssues, ...geofenceIssues, ...qualityWarnings]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

  const uniqueIssues = Array.from(new Set(issues))

  const isReliable = !hasAccuracyIssue && !hasTooFewReliableSamples
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
