import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Use localhost for server-side requests since we're on the same machine
  // This avoids going through the tunnel unnecessarily
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
  
  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        fetch: async (url: RequestInfo | URL, options: RequestInit = {}) => {
          const urlString = typeof url === 'string' ? url : url.toString()
          console.log('[Server Fetch Override] Called with URL:', urlString)
          
          // Only add Accept-Profile header for REST API requests (database queries)
          if (urlString.includes('/rest/v1')) {
            console.log('[Server Fetch Override] ✅ Detected REST API call')
            // Use Headers object to ensure proper header handling
            const headers = new Headers(options.headers)
            
            // Remove any existing Accept-Profile header first (case-insensitive)
            headers.delete('Accept-Profile')
            headers.delete('accept-profile')
            headers.delete('ACCEPT-PROFILE')
            
            // Set both Accept-Profile and Content-Profile to tryon_schema
            // Content-Profile is used for write operations (POST, PUT, PATCH)
            headers.set('Accept-Profile', 'tryon_schema')
            headers.set('Content-Profile', 'tryon_schema')
            
            const newOptions: RequestInit = {
              ...options,
              headers: headers,
            }
            console.log('[Server] ✅ Setting Accept-Profile to tryon_schema for:', urlString)
            console.log('[Server] Headers being sent:', Array.from(headers.entries()))
            return fetch(url, newOptions)
          }
          // For auth and other requests, don't add the header
          console.log('[Server Fetch Override] ❌ Not a REST API call, skipping header')
          return fetch(url, options)
        },
      },
    }
  )
}

