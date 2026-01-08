import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json')
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
    return NextResponse.json(
      { error: 'Failed to load manifest' },
      { status: 500 }
    )
  }
}
