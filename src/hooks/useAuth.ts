'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/types'

type SupabaseAuthUser = {
  id: string
  email?: string
  user_metadata?: {
    name?: string
    role?: 'admin' | 'karyawan' | string
  }
}

type UserProfileResult = {
  data: {
    name?: string | null
    role?: string | null
  } | null
  error: {
    message?: string
  } | null
}

type AuthSessionResult = {
  data: {
    session: {
      user: SupabaseAuthUser
    } | null
  }
  error?: {
    message?: string
  } | null
}

const AUTH_REQUEST_TIMEOUT_MS = 15000


const getDashboardRole = (role?: string): 'admin' | 'karyawan' =>
  role === 'admin' ? 'admin' : 'karyawan'

const withTimeout = async <T,>(promise: PromiseLike<T>, label: string): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`${label} timed out, continuing with fallback auth data`)
          resolve(null)
        }, AUTH_REQUEST_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

const getUserWithProfile = async (authUser: SupabaseAuthUser): Promise<AuthUser> => {
  const profileResult = await withTimeout(
    supabase
      .from('users')
      .select('name, role')
      .eq('user_id', authUser.id)
      .maybeSingle() as PromiseLike<UserProfileResult>,

    'Loading user profile'
  )

  // Supabase JS biasanya mengembalikan error di profileResult.error (bukan object kosong).
  if (!profileResult) {
    console.warn('[useAuth] profileResult is null/undefined', { authUserId: authUser.id })
  }


  const profile = profileResult?.data
  const error = profileResult?.error

  if (error) {
    console.error('Error getting user profile:', error)
  }

  // Kalau profile tidak ketemu / error, role akan default karyawan.
  // (Supabase RLS kemungkinan membuat select dari public.users tidak terizinkan.)
  const dashboardRole = getDashboardRole(profile?.role || undefined)

  // Debug: bantu lacak kalau RLS menolak select atau profile tidak ketemu.
  if (!profile?.role) {
    console.warn('[useAuth] profile role empty', { userId: authUser.id, email: authUser.email, error })
  }


  return {
    id: authUser.id,
    email: authUser.email || '',
    user_metadata: {
      ...authUser.user_metadata,
      name: profile?.name || authUser.user_metadata?.name,
      role: dashboardRole,
    },
  }


}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession() as PromiseLike<AuthSessionResult>,
          'Loading auth session'
        )
        const session = sessionResult?.data.session

        if (session?.user) {
          setUser(await getUserWithProfile(session.user))
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Error getting session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      try {
        if (session?.user) {
          setUser(await getUserWithProfile(session.user))
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Error handling auth state change:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return { user, loading }
}
