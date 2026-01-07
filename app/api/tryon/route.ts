import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getTryOnProvider } from '@/src/server/tryon/providers'
import { getSignedUrl } from '@/lib/storage'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    const { actor_photo_id, garment_image_id, settings } = body
    
    if (!actor_photo_id || !garment_image_id) {
      return NextResponse.json(
        { error: 'actor_photo_id and garment_image_id are required' },
        { status: 400 }
      )
    }
    
    // Get actor photo and garment image
    const { data: actorPhoto, error: actorError } = await supabase
      .from('actor_photos')
      .select('*')
      .eq('id', actor_photo_id)
      .single()
    
    if (actorError || !actorPhoto) {
      return NextResponse.json({ error: 'Actor photo not found' }, { status: 404 })
    }
    
    const { data: garmentImage, error: garmentError } = await supabase
      .from('garment_images')
      .select('*')
      .eq('id', garment_image_id)
      .single()
    
    if (garmentError || !garmentImage) {
      return NextResponse.json({ error: 'Garment image not found' }, { status: 404 })
    }
    
    // Create try-on job record
    const { data: job, error: jobError } = await supabase
      .from('tryon_jobs')
      .insert({
        actor_photo_id,
        garment_image_id,
        provider: process.env.TRYON_PROVIDER || 'stub',
        status: 'queued',
        settings: settings || {},
        created_by: user.id,
      })
      .select()
      .single()
    
    if (jobError) throw jobError
    
    // Generate public proxy URLs for images
    // FASHN and other external APIs need publicly accessible URLs
    // We use a proxy endpoint that serves the images from our server
    const requestUrl = new URL(request.url)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   `${requestUrl.protocol}//${requestUrl.host}`
    
    // Check if URL is publicly accessible (not localhost or private IP)
    const hostname = new URL(baseUrl).hostname
    const isLocal = hostname === 'localhost' || 
                   hostname === '127.0.0.1' || 
                   hostname.startsWith('192.168.') ||
                   hostname.startsWith('10.') ||
                   hostname.startsWith('172.')
    
    if (isLocal && !process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({
        error: 'Local development requires a publicly accessible URL. Please set NEXT_PUBLIC_APP_URL in your .env.local file (e.g., using ngrok: https://your-ngrok-url.ngrok.io)',
        details: `Current URL (${baseUrl}) is not publicly accessible. FASHN API needs to access your images from the internet.`
      }, { status: 400 })
    }
    
    const actorImageUrl = `${baseUrl}/api/storage/proxy?bucket=actors&path=${encodeURIComponent(actorPhoto.storage_path)}`
    const garmentImageUrl = `${baseUrl}/api/storage/proxy?bucket=garments&path=${encodeURIComponent(garmentImage.storage_path)}`
    
    console.log('[Try-on] Generated proxy URLs:', { 
      actorImageUrl, 
      garmentImageUrl, 
      baseUrl,
      actorPhotoPath: actorPhoto.storage_path,
      garmentImagePath: garmentImage.storage_path
    })
    
    // Verify URLs are proxy URLs, not signed URLs
    if (actorImageUrl.includes('/storage/v1/object/sign') || garmentImageUrl.includes('/storage/v1/object/sign')) {
      console.error('[Try-on] ERROR: Proxy URLs contain signed URL pattern!', { actorImageUrl, garmentImageUrl })
    }
    
    // Submit to provider
    const provider = getTryOnProvider()
    const result = await provider.submitTryOn({
      actorImageUrl,
      garmentImageUrl,
      options: settings,
    })
    
    // Update job status
    if (result.resultUrl && !result.isAsync) {
      // Sync provider - download result and upload to storage
      const response = await fetch(result.resultUrl)
      if (!response.ok) {
        throw new Error('Failed to download result image')
      }
      
      const blob = await response.blob()
      const buffer = Buffer.from(await blob.arrayBuffer())
      const resultPath = `results/${job.id}.jpg`
      
      const { uploadFile } = await import('@/lib/storage')
      const uploadedPath = await uploadFile('tryons', resultPath, buffer)
      
      if (uploadedPath) {
        await supabase
          .from('tryon_jobs')
          .update({
            status: 'succeeded',
            result_storage_path: uploadedPath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }
    } else if (result.jobId) {
      // Async provider
      await supabase
        .from('tryon_jobs')
        .update({
          status: 'running',
          provider_job_id: result.jobId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    }
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'tryon_created',
      resource_type: 'tryon_job',
      resource_id: job.id,
      details: { 
        provider: process.env.TRYON_PROVIDER || 'stub',
        status: job.status,
        actor_photo_id,
        garment_image_id,
      },
      ...metadata,
    })
    
    return NextResponse.json(job, { status: 201 })
  } catch (error: any) {
    console.error('Try-on error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    })
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null
    }, { status: 500 })
  }
}

