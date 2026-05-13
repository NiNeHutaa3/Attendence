export const getAuthErrorMessage = (message?: string) => {
  const fallback = message || 'Authentication failed'
  const normalized = fallback.toLowerCase()

  if (
    normalized.includes('email rate limit') ||
    (normalized.includes('rate limit') && normalized.includes('email'))
  ) {
    return 'Supabase email rate limit reached. For development, disable Confirm email in Supabase Auth > Providers > Email, or wait for the limit to reset. For production, configure custom SMTP.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Email atau password salah.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Untuk development, matikan Confirm email di Supabase Auth > Providers > Email.'
  }

  if (normalized.includes('user already registered') || normalized.includes('already registered')) {
    return 'Email ini sudah terdaftar. Silakan login.'
  }

  return fallback
}
