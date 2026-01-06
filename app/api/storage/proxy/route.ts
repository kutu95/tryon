import { NextRequest, NextResponse } from 'next/server'
import { downloadFile } from '@/lib/storage'

export const dynamic = 'force-dynamic' // Mark as dynamic to prevent static generation errors

/**
 * Proxy endpoint to serve storage files publicly for external APIs
 * This allows FASHN and other services to access images that are in private buckets
 * Note: This is intentionally public - no auth required as it's for external API access
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')
    
    console.log('[Storage Proxy] Request:', { bucket, path, url: request.url })
    
    if (!bucket || !path) {
      console.error('[Storage Proxy] Missing parameters:', { bucket, path })
      return NextResponse.json(
        { error: 'bucket and path are required' },
        { status: 400 }
      )
    }
    
    // Decode the path in case it's URL encoded
    const decodedPath = decodeURIComponent(path)
    console.log('[Storage Proxy] Downloading file:', { bucket, decodedPath })
    
    // Download the file from storage
    const blob = await downloadFile(bucket, decodedPath)
    if (!blob) {
      console.error('[Storage Proxy] Failed to download file:', { bucket, decodedPath })
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 404 }
      )
    }
    
    console.log('[Storage Proxy] File downloaded successfully, size:', blob.size)
    
    // Return the file with appropriate headers
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Determine content type from file extension
    const extension = decodedPath.split('.').pop()?.toLowerCase()
    const contentType = 
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
      extension === 'png' ? 'image/png' :
      extension === 'gif' ? 'image/gif' :
      extension === 'webp' ? 'image/webp' :
      'application/octet-stream'
    
    console.log('[Storage Proxy] Returning file:', { contentType, size: buffer.length })
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('[Storage Proxy] Error:', error)
    console.error('[Storage Proxy] Error stack:', error.stack)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack 
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

