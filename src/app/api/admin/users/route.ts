import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type CreateUserPayload = {
  email?: string
  password?: string
  name?: string
  role?: 'admin' | 'karyawan'
  geofenceId?: string | null
}

const getEnvError = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return 'Missing Supabase environment variables for admin user creation'
  }

  return null
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: 'Only admins can create users' }, { status: 403 })
  }

  const payload = (await request.json()) as CreateUserPayload
  const email = payload.email?.trim().toLowerCase()
  const name = payload.name?.trim()
  const role = payload.role === 'admin' ? 'admin' : 'karyawan'
  const geofenceId = role === 'karyawan' ? payload.geofenceId || null : null

  if (!email || !name || !payload.password) {
    return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 })
  }

  if (payload.password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
  }

  if (role === 'karyawan' && !geofenceId) {
    return NextResponse.json({ error: 'Geofence wajib dipilih untuk karyawan' }, { status: 400 })
  }

  const { data: createdUser, error: createError } = await serviceSupabase.auth.admin.createUser({
    email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      geofence_id: geofenceId,
    },
  })

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to create auth user' },
      { status: 400 }
    )
  }

  const { error: profileError } = await serviceSupabase.from('users').upsert({
    user_id: createdUser.user.id,
    email,
    name,
    role,
    geofence_id: geofenceId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (profileError) {
    await serviceSupabase.auth.admin.deleteUser(createdUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({
    user: {
      user_id: createdUser.user.id,
      email,
      name,
      role,
      geofence_id: geofenceId,
    },
  })
}

export async function DELETE(request: Request) {
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
    return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
  }

  const { userId } = (await request.json()) as { userId?: string }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  if (userId === currentUser.id) {
    return NextResponse.json({ error: 'Admin tidak dapat menghapus akun yang sedang dipakai' }, { status: 400 })
  }

  const { data: targetUser, error: targetError } = await serviceSupabase
    .from('users')
    .select('user_id,email,name,role')
    .eq('user_id', userId)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 400 })
  }

  if (!targetUser) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
  }

  if (targetUser.role === 'admin') {
    const { count, error: countError } = await serviceSupabase
      .from('users')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin')

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 })
    }

    if ((count || 0) <= 1) {
      return NextResponse.json({ error: 'Tidak dapat menghapus admin terakhir' }, { status: 400 })
    }
  }

  const { error: profileDeleteError } = await serviceSupabase
    .from('users')
    .delete()
    .eq('user_id', userId)

  if (profileDeleteError) {
    return NextResponse.json({ error: profileDeleteError.message }, { status: 400 })
  }

  const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(userId)

  if (authDeleteError && !/not found/i.test(authDeleteError.message)) {
    return NextResponse.json({ error: authDeleteError.message }, { status: 400 })
  }

  return NextResponse.json({
    deletedUser: {
      user_id: targetUser.user_id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
    },
  })
}
