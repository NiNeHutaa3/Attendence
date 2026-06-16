// Types for database models
export type User = {
  user_id: string
  email: string
  name: string
  role: 'admin' | 'karyawan'
  geofence_id?: string | null
  geofence?: Geofence | null
  created_at: string
  updated_at?: string
}

export type Attendance = {
  attendance_id: string
  user_id: string
  check_in_time: string
  check_out_time?: string | null
  status: 'valid' | 'invalid'
  anomaly_status: boolean
  anomaly_reason?: string | null
  created_at: string
  updated_at?: string
}

export type PhotoAttendance = {
  photo_id: string
  attendance_id: string
  event_type?: 'checkin' | 'checkout'
  photo_url: string
  captured_at: string
  created_at: string
}

export type LocationLog = {
  location_id: string
  attendance_id: string
  event_type?: 'checkin' | 'checkout'
  latitude: number
  longitude: number
  distance_from_center: number
  is_within_geofence: boolean
  created_at: string
}

export type AccessLog = {
  log_id: string
  attendance_id: string
  event_type?: 'checkin' | 'checkout'
  user_agent: string
  ip_address: string
  ip_region?: string | null
  is_vpn: boolean
  developer_mode_active?: boolean
  created_at: string
}

export type Geofence = {
  geofence_id: string
  location_name: string
  latitude_center: number
  longitude_center: number
  radius: number
  created_at?: string
  updated_at?: string
}

export type AuthUser = {
  id: string
  email: string
  user_metadata?: {
    name?: string
    role?: 'admin' | 'karyawan'
  }
}

export type AttendanceDetail = Attendance & {
  user: User
  photos: PhotoAttendance[]
  locations: LocationLog[]
  access_logs: AccessLog[]
}
