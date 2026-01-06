import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url: RequestInfo | URL, options: RequestInit = {}) => {
          const urlString = typeof url === 'string' ? url : url.toString()
          
          // Only add Accept-Profile header for REST API requests (database queries)
          if (urlString.includes('/rest/v1')) {
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
            console.log('[Client] Setting Accept-Profile to tryon_schema for:', urlString)
            console.log('[Client] All headers:', Array.from(headers.entries()))
            return fetch(url, newOptions)
          }
          // For auth and other requests, don't add the header
          return fetch(url, options)
        },
      },
    }
  )
}

