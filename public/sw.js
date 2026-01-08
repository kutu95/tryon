// Service Worker for Costume Stylist Virtual Try-On
const CACHE_NAME = 'costume-stylist-v2'
const urlsToCache = [
  '/studio',
  '/actors',
  '/garments',
  '/boards',
  '/help',
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
  // Skip caching for API routes and external resources
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase') ||
    event.request.url.includes('fashn')
  ) {
    return
  }

  // Skip caching for root path since it redirects
  const url = new URL(event.request.url)
  if (url.pathname === '/' || url.pathname === '/login') {
    // For redirecting pages, always fetch from network with redirect: 'follow'
    event.respondWith(
      fetch(event.request, { redirect: 'follow' })
        .catch(() => {
          // If network fails, try cache as fallback
          return caches.match(event.request)
        })
    )
    return
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request, { redirect: 'follow' }).then((response) => {
          // Don't cache non-successful responses or redirects
          if (!response || response.status !== 200 || response.type !== 'basic' || response.redirected) {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache)
            })

          return response
        })
      })
      .catch(() => {
        // If both cache and network fail, return offline page if available
        if (event.request.destination === 'document') {
          return caches.match('/studio')
        }
      })
  )
})
