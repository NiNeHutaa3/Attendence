import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  evaluateAttendanceAnomaly,
  lookupIpRegion,
} from '@/utils/anomaly-detection'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const getForwardedIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  return forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || 'unavailable'
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables for anomaly detection' },
      { status: 500 }
    )
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
    data: { user },
    error: authError,
  } = await serviceSupabase.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    ipAddress?: string
  }
  const ipAddress = body.ipAddress?.trim() || getForwardedIp(request)
  const ipRegion = await lookupIpRegion(ipAddress)
  const anomaly = evaluateAttendanceAnomaly({
    ipRegion: ipRegion.region,
    countryCode: ipRegion.countryCode,
  })

  return NextResponse.json({
    ipAddress: ipRegion.ipAddress,
    ipRegion: ipRegion.region,
    ...anomaly,
  })
}
