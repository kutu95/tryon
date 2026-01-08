import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Try to read from backup location first, then public
    let manifestPath = join(process.cwd(), 'public', 'manifest.json.bak')
    if (!require('fs').existsSync(manifestPath)) {
      manifestPath = join(process.cwd(), 'public', 'manifest.json')
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
