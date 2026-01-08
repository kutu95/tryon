'use client'

import { useEffect } from 'react'

export function PWAScript() {
  useEffect(() => {
    // Add mobile-web-app-capable meta tag
    if (typeof document !== 'undefined') {
      const existingMeta = document.querySelector('meta[name="mobile-web-app-capable"]')
      if (!existingMeta) {
        const meta = document.createElement('meta')
        meta.name = 'mobile-web-app-capable'
        meta.content = 'yes'
        document.head.appendChild(meta)
      }
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful:', registration.scope)
        })
        .catch((err) => {
          console.log('ServiceWorker registration failed:', err)
        })
    }
  }, [])

  return null
}
