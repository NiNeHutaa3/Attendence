import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type SupabaseUserRow = {
  user_id: string
  email: string
  name: string | null
  role: 'admin' | 'karyawan'
  geofence_id: string | null
  created_at: string
}

const getEnvError = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return 'Missing Supabase environment variables for admin users list'
  }
  return null
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
    return NextResponse.json({ error: 'Only admins can list users' }, { status: 403 })
  }

  const { data, error } = await serviceSupabase
    .from('users')
    .select(
      `user_id, email, name, role, geofence_id, created_at, geofence:geofence_id(*)`
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ users: (data || []) as SupabaseUserRow[] })
}

