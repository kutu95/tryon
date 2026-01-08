import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Try to read from backup location first, then public
    let manifestPath = join(process.cwd(), 'public', 'manifest.json.bak')
    const fs = require('fs')
    if (!fs.existsSync(manifestPath)) {
      manifestPath = join(process.cwd(), 'public', 'manifest.json')
    }
    
    // If neither exists, return inline manifest
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json({
        name: "Costume Stylist Virtual Try-On",
        short_name: "Costume Stylist",
        description: "2D virtual try-on for costume styling",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4f46e5",
        orientation: "portrait-primary",
        icons: [
          { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
          { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
          { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        categories: ["fashion", "productivity", "utilities"],
        shortcuts: [
          { name: "Studio", short_name: "Studio", description: "Create virtual try-ons", url: "/studio", icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192" }] },
          { name: "Actors", short_name: "Actors", description: "Manage actors", url: "/actors", icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192" }] },
          { name: "Garments", short_name: "Garments", description: "Manage garments", url: "/garments", icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192" }] },
        ],
      }, {
        headers: {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    
    const manifestContent = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestContent)
    
    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('[API] Error serving manifest:', error)
    // Return a minimal valid manifest as fallback
    return NextResponse.json({
      name: "Costume Stylist Virtual Try-On",
      short_name: "Costume Stylist",
      start_url: "/",
      display: "standalone",
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    }, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }
}
