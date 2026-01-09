import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'

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
    
    // Decode the path in case it's double-encoded
    const decodedPath = decodeURIComponent(path)
    
    console.log('[Signed URL] Request:', { bucket, path: decodedPath })
    
    const url = await getSignedUrl(bucket, decodedPath)
    if (!url) {
      console.error('[Signed URL] Failed to generate URL for:', { bucket, path: decodedPath })
      return NextResponse.json(
        { error: 'Failed to generate signed URL. The file may not exist or you may not have permission.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('[Signed URL] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.stack },
      { status: 500 }
    )
  }
}

