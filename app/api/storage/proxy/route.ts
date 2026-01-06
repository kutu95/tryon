import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { downloadFile } from '@/lib/storage'

/**
 * Proxy endpoint to serve storage files publicly for external APIs
 * This allows FASHN and other services to access images that are in private buckets
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')
    
    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'bucket and path are required' },
        { status: 400 }
      )
    }
    
    // Download the file from storage
    const blob = await downloadFile(bucket, path)
    if (!blob) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 404 }
      )
    }
    
    // Return the file with appropriate headers
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Determine content type from file extension
    const extension = path.split('.').pop()?.toLowerCase()
    const contentType = 
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
      extension === 'png' ? 'image/png' :
      extension === 'gif' ? 'image/gif' :
      extension === 'webp' ? 'image/webp' :
      'application/octet-stream'
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('Storage proxy error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

