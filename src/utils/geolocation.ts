import { point, distance } from '@turf/turf'

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const DEFAULT_GEOFENCE_RADIUS = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS, 100)
const DEFAULT_GEOFENCE_LAT = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LAT, -6.2088)
const DEFAULT_GEOFENCE_LNG = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_LNG, 106.8456)

export const getCurrentLocation = (): Promise<GeolocationCoordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position.coords)
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
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

export const isWithinGeofence = (
  distance: number,
  radius: number = DEFAULT_GEOFENCE_RADIUS
): boolean => {
  return distance <= radius
}

export const checkAttendanceValidity = (
  userLat: number,
  userLng: number,
  centerLat: number = DEFAULT_GEOFENCE_LAT,
  centerLng: number = DEFAULT_GEOFENCE_LNG,
  radius: number = DEFAULT_GEOFENCE_RADIUS
): { isValid: boolean; distance: number } => {
  const dist = calculateDistance(userLat, userLng, centerLat, centerLng)
  const isValid = isWithinGeofence(dist, radius)

  return {
    isValid,
    distance: dist,
  }
}

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}
