import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAttendanceEffectiveStatus } from '@/utils/attendance-validation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const getEnvError = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return 'Missing Supabase environment variables for admin attendance list'
  }

  return null
}

const getDayRange = (startDateStr?: string, endDateStr?: string) => {
  if (!startDateStr || !endDateStr) {
    return null
  }

  const startDate = new Date(`${startDateStr}T00:00:00+07:00`)
  const endDate = new Date(`${endDateStr}T23:59:59.999+07:00`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  }
}

export async function GET(request: Request) {
  const envError = getEnvError()

  if (envError || !supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: envError }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user: currentUser },
    error: authError,
  } = await serviceSupabase.auth.getUser(token)

  if (authError || !currentUser) {
    return NextResponse.json({ error: 'Invalid admin session' }, { status: 401 })
  }

  const { data: adminProfile, error: adminError } = await serviceSupabase
    .from('users')
    .select('role')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  const isAdmin =
    adminProfile?.role === 'admin' || currentUser.user_metadata?.role === 'admin'

  if (adminError || !isAdmin) {
    return NextResponse.json({ error: 'Only admins can view attendance' }, { status: 403 })
  }

  const url = new URL(request.url)
  const startDateStr = url.searchParams.get('startDate') || undefined
  const endDateStr = url.searchParams.get('endDate') || undefined
  const userId = url.searchParams.get('userId') || 'all'
  const status = url.searchParams.get('status') || 'all'
  const range = getDayRange(startDateStr, endDateStr)

  if (!range) {
    return NextResponse.json(
      { error: 'startDate dan endDate wajib dengan format YYYY-MM-DD' },
      { status: 400 }
    )
  }

  let attendanceQuery = serviceSupabase
    .from('attendance')
    .select('attendance_id,user_id,check_in_time,check_out_time,status,anomaly_status,anomaly_reason,created_at,updated_at')
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  if (userId !== 'all') {
    attendanceQuery = attendanceQuery.eq('user_id', userId)
  }

  const { data: attendanceRows, error: attendanceError } = await attendanceQuery.order(
    'created_at',
    { ascending: false }
  )

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message }, { status: 500 })
  }

  const attendance = attendanceRows || []

  if (attendance.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const attendanceIds = attendance.map((record) => record.attendance_id)
  const userIds = Array.from(new Set(attendance.map((record) => record.user_id)))

  const [
    { data: users, error: usersError },
    { data: photos, error: photosError },
    { data: locations, error: locationsError },
    { data: accessLogs, error: accessLogsError },
  ] = await Promise.all([
    serviceSupabase
      .from('users')
      .select('user_id,email,name,role,geofence_id,geofence:geofence_id(location_name,radius)')
      .in('user_id', userIds),
    serviceSupabase
      .from('photo_attendance')
      .select('*')
      .in('attendance_id', attendanceIds)
      .order('created_at', { ascending: true }),
    serviceSupabase
      .from('location_log')
      .select('*')
      .in('attendance_id', attendanceIds)
      .order('created_at', { ascending: true }),
    serviceSupabase
      .from('access_log')
      .select('*')
      .in('attendance_id', attendanceIds)
      .order('created_at', { ascending: true }),
  ])

  const firstError = usersError || photosError || locationsError || accessLogsError

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const usersById = new Map(
    (users || []).map((user) => [
      user.user_id,
      {
        ...user,
        geofence: Array.isArray(user.geofence) ? user.geofence[0] || null : user.geofence,
      },
    ])
  )
  const groupByAttendance = <T extends { attendance_id: string }>(rows: T[] = []) =>
    rows.reduce<Record<string, T[]>>((groups, row) => {
      groups[row.attendance_id] = groups[row.attendance_id] || []
      groups[row.attendance_id].push(row)
      return groups
    }, {})

  const photosByAttendance = groupByAttendance(photos || [])
  const locationsByAttendance = groupByAttendance(locations || [])
  const accessLogsByAttendance = groupByAttendance(accessLogs || [])

  const records = attendance.map((record) => {
    const recordPhotos = photosByAttendance[record.attendance_id] || []
    const recordLocations = locationsByAttendance[record.attendance_id] || []
    const recordAccessLogs = accessLogsByAttendance[record.attendance_id] || []

    return {
      ...record,
      status: getAttendanceEffectiveStatus(record.status, {
        photos: recordPhotos,
        locations: recordLocations,
        access_logs: recordAccessLogs,
      }),
      user: usersById.get(record.user_id) || null,
      photos: recordPhotos,
      locations: recordLocations,
      access_logs: recordAccessLogs,
    }
  })

  return NextResponse.json({
    records: records.filter((record) => status === 'all' || record.status === status),
  })
}
