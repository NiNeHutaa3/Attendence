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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const tables = ['photo_attendance', 'location_log', 'access_log']

for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  console.log(`\n${table}`)

  if (error) {
    console.log('select error:', error.message)
    console.log('details:', error.details || '-')
    console.log('hint:', error.hint || '-')
    continue
  }

  console.log('select ok')
  console.log('sample keys:', data[0] ? Object.keys(data[0]).join(', ') : '(table empty)')
}

const { data: photos, error: photosError } = await supabase
  .from('photo_attendance')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('\nlatest photo_attendance rows')

if (photosError) {
  console.log('error:', photosError.message)
} else {
  console.log(photos)
}

const { data: attendance, error: attendanceError } = await supabase
  .from('attendance')
  .select('attendance_id,user_id,check_in_time,check_out_time,status,created_at,updated_at')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('\nlatest attendance rows')

if (attendanceError) {
  console.log('error:', attendanceError.message)
} else {
  console.log(attendance)
}

const { data: locations, error: locationsError } = await supabase
  .from('location_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('\nlatest location_log rows')

if (locationsError) {
  console.log('error:', locationsError.message)
} else {
  console.log(locations)
}

const { data: accessLogs, error: accessLogsError } = await supabase
  .from('access_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('\nlatest access_log rows')

if (accessLogsError) {
  console.log('error:', accessLogsError.message)
} else {
  console.log(accessLogs)
}
