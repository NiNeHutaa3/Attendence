export type AttendanceStatus = 'valid' | 'invalid'

type EventType = 'checkin' | 'checkout'

type PhotoEvidence = {
  event_type?: EventType | string | null
  photo_url?: string | null
  captured_at?: string | null
  created_at?: string | null
}

type LocationEvidence = {
  event_type?: EventType | string | null
  latitude?: number | string | null
  longitude?: number | string | null
  distance_from_center?: number | string | null
  is_within_geofence?: boolean | null
  created_at?: string | null
}

type AccessEvidence = {
  event_type?: EventType | string | null
  user_agent?: string | null
  ip_address?: string | null
  created_at?: string | null
}

export type AttendanceEvidence = {
  photos?: PhotoEvidence[]
  locations?: LocationEvidence[]
  accessLogs?: AccessEvidence[]
  access_logs?: AccessEvidence[]
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isValidDateString = (value: unknown) =>
  isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime())

const isFiniteNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue)
}

const isEventEvidence = <T extends { event_type?: string | null }>(
  evidence: T,
  eventType: EventType
) => (evidence.event_type || 'checkin') === eventType

export const hasCompleteAttendanceEvidence = (
  evidence: AttendanceEvidence,
  eventType: EventType = 'checkin'
) => {
  const photos = evidence.photos || []
  const locations = evidence.locations || []
  const accessLogs = evidence.accessLogs || evidence.access_logs || []

  const hasPhoto = photos.some(
    (photo) =>
      isEventEvidence(photo, eventType) &&
      isNonEmptyString(photo.photo_url) &&
      isValidDateString(photo.captured_at || photo.created_at)
  )

  const hasLocation = locations.some(
    (location) =>
      isEventEvidence(location, eventType) &&
      isFiniteNumber(location.latitude) &&
      isFiniteNumber(location.longitude) &&
      isFiniteNumber(location.distance_from_center) &&
      location.is_within_geofence === true &&
      isValidDateString(location.created_at)
  )

  const hasAccessLog = accessLogs.some(
    (accessLog) =>
      isEventEvidence(accessLog, eventType) &&
      isNonEmptyString(accessLog.user_agent) &&
      isNonEmptyString(accessLog.ip_address) &&
      isValidDateString(accessLog.created_at)
  )

  return hasPhoto && hasLocation && hasAccessLog
}

export const getAttendanceEffectiveStatus = (
  storedStatus: AttendanceStatus | string | null | undefined,
  evidence: AttendanceEvidence,
  eventType: EventType = 'checkin'
): AttendanceStatus => {
  if (storedStatus !== 'valid') {
    return 'invalid'
  }

  return hasCompleteAttendanceEvidence(evidence, eventType) ? 'valid' : 'invalid'
}
