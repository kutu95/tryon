import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  // Use localhost for server-side requests since we're on the same machine
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
  
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          // Only add Accept-Profile header for REST API requests (database queries)
          const urlString = typeof url === 'string' ? url : url.toString()
          if (urlString.includes('/rest/v1/')) {
            const headers = new Headers(options.headers)
            headers.set('Accept-Profile', 'tryon_schema')
            return fetch(url, {
              ...options,
              headers,
            })
          }
          // For auth and other requests, don't add the header
          return fetch(url, options)
        },
      },
    }
  )
}

