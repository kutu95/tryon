// Service Worker for Costume Stylist Virtual Try-On
// Bump version when changing caching rules (clients drop old caches on activate).
const CACHE_NAME = 'costume-stylist-v5'
// Only precache public static assets — not /studio, /actors, etc. Those require
// auth and often 307 to /login during install; caching them causes brittle SW
// behavior and confusing offline fallbacks.
const urlsToCache = [
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('Cache install failed:', error)
      })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip service worker for API routes and external resources - let browser handle them
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase') ||
    event.request.url.includes('fashn') ||
    event.request.url.includes('googleapis') ||
    event.request.url.includes('gstatic')
  ) {
    return
  }

  // Full document navigations (address bar, links with full load): do NOT intercept.
  // Handling these with fetch()+respondWith() breaks native 307/302 handling in
  // some browsers (ERR_FAILED on /studio instead of following redirect to /login).
  if (event.request.mode === 'navigate') {
    return
  }

  // For other requests (assets, images, etc.), try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response
        }
        
        // Otherwise fetch from network
        return fetch(event.request, { redirect: 'follow' })
          .then((response) => {
            // Only cache successful, non-redirected responses
            if (response && response.status === 200 && response.type === 'basic' && !response.redirected) {
              const responseToCache = response.clone()
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache).catch(() => {
                    // Ignore cache errors
                  })
                })
            }
            return response
          })
      })
      .catch((error) => {
        // If both cache and network fail, return error
        console.error('Service worker fetch error:', error)
        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        })
      })
  )
})
