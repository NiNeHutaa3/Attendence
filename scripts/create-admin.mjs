import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [
        line.slice(0, index).trim(),
        line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      ]
    })
)

const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingEnv = requiredEnv.filter((key) => !env[key])

if (missingEnv.length > 0) {
  throw new Error(`Missing env: ${missingEnv.join(', ')}`)
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const email = 'admin@gmail.com'
const password = 'admin123'
const name = 'Admin'

const findAuthUserByEmail = async () => {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })

    if (error) {
      throw error
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)

    if (user || data.users.length < 1000) {
      return user || null
    }

    page += 1
  }
}

let authUser = null

const created = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    name,
    role: 'admin',
  },
})

if (created.error) {
  if (!/already|registered|exists/i.test(created.error.message)) {
    throw created.error
  }

  authUser = await findAuthUserByEmail()

  if (!authUser) {
    throw new Error('Auth user already exists, but it was not found via listUsers.')
  }

  const updated = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(authUser.user_metadata || {}),
      name,
      role: 'admin',
    },
  })

  if (updated.error) {
    throw updated.error
  }

  authUser = updated.data.user
  console.log('Auth user existed; password and metadata updated.')
} else {
  authUser = created.data.user
  console.log('Auth user created.')
}

const now = new Date().toISOString()
const { data: profile, error: profileError } = await supabase
  .from('users')
  .upsert(
    {
      user_id: authUser.id,
      email,
      name,
      role: 'admin',
      geofence_id: null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  )
  .select('user_id,email,name,role')
  .single()

if (profileError) {
  throw profileError
}

console.log('Admin profile ready:', profile)
