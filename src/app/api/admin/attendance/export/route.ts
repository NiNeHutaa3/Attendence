import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { getAttendanceEffectiveStatus } from '@/utils/attendance-validation'


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const getEnvError = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return 'Missing Supabase environment variables for admin attendance export'
  }
  return null
}

const parseISODate = (value?: string) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(request: Request) {
  const envError = getEnvError()
  if (envError || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
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

  // verify admin
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
    return NextResponse.json({ error: 'Only admins can export attendance' }, { status: 403 })
  }

  const url = new URL(request.url)
  const startDateStr = url.searchParams.get('startDate') || undefined
  const endDateStr = url.searchParams.get('endDate') || undefined
  const userId = url.searchParams.get('userId') || undefined
  const statusParam = url.searchParams.get('status') || 'all'

  const startDate = parseISODate(startDateStr)
  const endDate = parseISODate(endDateStr)

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate dan endDate wajib dengan format ISO (YYYY-MM-DD)' }, { status: 400 })
  }

  // make endDate inclusive (end of day)
  const startOfDay = new Date(startDate.toISOString())
  const endOfDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)

  let query = serviceSupabase
    .from('attendance')
    .select('*, user:user_id(user_id, email, name, role)')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())

  if (userId && userId !== 'all') {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const attendance = data || []
  const attendanceIds = attendance.map((record: any) => record.attendance_id)

  const [
    { data: photos, error: photosError },
    { data: locations, error: locationsError },
    { data: accessLogs, error: accessLogsError },
  ] = attendanceIds.length
    ? await Promise.all([
        serviceSupabase
          .from('photo_attendance')
          .select('attendance_id,event_type,photo_url,captured_at,created_at')
          .in('attendance_id', attendanceIds),
        serviceSupabase
          .from('location_log')
          .select('attendance_id,event_type,latitude,longitude,distance_from_center,is_within_geofence,created_at')
          .in('attendance_id', attendanceIds),
        serviceSupabase
          .from('access_log')
          .select('attendance_id,event_type,user_agent,ip_address,created_at')
          .in('attendance_id', attendanceIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ]

  const evidenceError = photosError || locationsError || accessLogsError

  if (evidenceError) {
    return NextResponse.json({ error: evidenceError.message }, { status: 500 })
  }

  const groupByAttendance = (rows: any[] = []) =>
    rows.reduce<Record<string, any[]>>((groups, row) => {
      groups[row.attendance_id] = groups[row.attendance_id] || []
      groups[row.attendance_id].push(row)
      return groups
    }, {})

  const photosByAttendance = groupByAttendance(photos || [])
  const locationsByAttendance = groupByAttendance(locations || [])
  const accessLogsByAttendance = groupByAttendance(accessLogs || [])

  const rows = attendance
    .map((record: any) => ({
      ...record,
      status: getAttendanceEffectiveStatus(record.status, {
        photos: photosByAttendance[record.attendance_id] || [],
        locations: locationsByAttendance[record.attendance_id] || [],
        access_logs: accessLogsByAttendance[record.attendance_id] || [],
      }),
    }))
    .filter((record: any) => statusParam === 'all' || record.status === statusParam)
    .map((record: any) => {
    const u = Array.isArray(record.user) ? record.user[0] : record.user
    return {
      Tanggal: new Date(record.created_at).toLocaleDateString('id-ID'),
      Nama: u?.name || '-',
      Email: u?.email || '-',
      'Check-in': record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      'Check-out': record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      Status: record.status,
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const fileName = `attendance_${startDateStr}_to_${endDateStr}.xlsx`

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}

