import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  // For auth admin API calls, use public URL if available (needed for tunnel)
  // For database queries, prefer localhost to avoid tunnel overhead
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321'
  const dbUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
  
  console.log('[Admin Client] Initializing with:', {
    authUrl,
    dbUrl,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  
  return createClient(
    authUrl, // Use public URL for auth admin API (needed for tunnel)
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          const urlString = typeof url === 'string' ? url : url.toString()
          
          // For REST API (database) requests, use localhost and add schema header
          if (urlString.includes('/rest/v1/')) {
            // Replace auth URL with DB URL for database queries
            const dbUrlString = urlString.replace(authUrl, dbUrl)
            const headers = new Headers(options.headers)
            headers.set('Accept-Profile', 'tryon_schema')
            headers.set('Content-Profile', 'tryon_schema')
            console.log('[Admin Client] DB request:', dbUrlString)
            return fetch(dbUrlString, {
              ...options,
              headers,
            })
          }
          
          // For auth admin API requests, use the auth URL (public/tunnel)
          console.log('[Admin Client] Auth request:', urlString)
          return fetch(url, options)
        },
      },
    }
  )
}

