import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { runTryOn, type TryOnError } from '@/lib/fashn'
import { uploadFile } from '@/lib/storage'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'
import { type TryOnRequest } from '@/lib/fashn/types'

export const runtime = 'nodejs' // Ensure Node.js runtime

export async function POST(request: NextRequest) {
  try {
    console.log('[API/tryon/v2] Request received')
    const user = await requireAuth()
    console.log('[API/tryon/v2] User authenticated:', user.id)
    const supabase = await createClient()
    const body = await request.json()
    console.log('[API/tryon/v2] Request body keys:', Object.keys(body))
    
    // Support both old format (actor_photo_id/garment_image_id) and new format (direct images)
    let modelImageUrl: string
    let garmentImageUrl: string
    
    if (body.actor_photo_id && body.garment_image_id) {
      // Old format - fetch from database
      const { data: actorPhoto, error: actorError } = await supabase
        .from('actor_photos')
        .select('*')
        .eq('id', body.actor_photo_id)
        .single()
      
      if (actorError || !actorPhoto) {
        return NextResponse.json({ error: 'Actor photo not found' }, { status: 404 })
      }
      
      const { data: garmentImage, error: garmentError } = await supabase
        .from('garment_images')
        .select('*')
        .eq('id', body.garment_image_id)
        .single()
      
      if (garmentError || !garmentImage) {
        return NextResponse.json({ error: 'Garment image not found' }, { status: 404 })
      }
      
      // Generate public proxy URLs
      const requestUrl = new URL(request.url)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                     `${requestUrl.protocol}//${requestUrl.host}`
      
      modelImageUrl = `${baseUrl}/api/storage/proxy?bucket=actors&path=${encodeURIComponent(actorPhoto.storage_path)}`
      garmentImageUrl = `${baseUrl}/api/storage/proxy?bucket=garments&path=${encodeURIComponent(garmentImage.storage_path)}`
    } else if (body.model_image && body.garment_image) {
      // New format - direct image URLs/base64
      modelImageUrl = body.model_image
      garmentImageUrl = body.garment_image
    } else {
      return NextResponse.json(
        { error: 'Either (actor_photo_id and garment_image_id) or (model_image and garment_image) are required' },
        { status: 400 }
      )
    }
    
    // Build try-on request with defaults
    const tryOnRequest: TryOnRequest = {
      model_image: modelImageUrl,
      garment_image: garmentImageUrl,
      category: body.category || 'auto',
      mode: body.mode || 'balanced',
      seed: body.seed,
      num_samples: body.num_samples || 1,
      garment_photo_type: body.garment_photo_type || 'auto',
      segmentation_free: body.segmentation_free !== undefined ? body.segmentation_free : true,
      moderation_level: body.moderation_level || 'permissive',
      output_format: body.output_format || 'png',
      return_base64: body.return_base64 || false,
    }
    
    // Call FASHN service
    console.log('[API/tryon/v2] Calling runTryOn with params:', {
      category: tryOnRequest.category,
      mode: tryOnRequest.mode,
      num_samples: tryOnRequest.num_samples,
      hasSeed: !!tryOnRequest.seed,
    })
    const startTime = Date.now()
    const result = await runTryOn(tryOnRequest)
    const duration = Date.now() - startTime
    console.log('[API/tryon/v2] runTryOn completed:', {
      resultsCount: result.results.length,
      isAsync: result.isAsync,
      jobId: result.jobId,
      duration,
    })
    
    // Handle async jobs (need to poll for results)
    if (result.isAsync && result.jobId && body.actor_photo_id && body.garment_image_id) {
      // Create a tryon_job record with status 'running' for async polling
      const { data: job, error: jobError } = await supabase
        .from('tryon_jobs')
        .insert({
          actor_photo_id: body.actor_photo_id,
          garment_image_id: body.garment_image_id,
          provider: 'fashn',
          status: 'running',
          provider_job_id: result.jobId,
          settings: {
            ...tryOnRequest,
            seed: tryOnRequest.seed,
          },
          created_by: user.id,
        })
        .select()
        .single()
      
      if (jobError) {
        console.error('[API/tryon/v2] Error creating async job record:', jobError)
        throw jobError
      }
      
      // Log audit event
      const metadata = getRequestMetadata(request)
      await logAuditEvent({
        user_id: user.id,
        event_type: 'tryon_created',
        resource_type: 'tryon_job',
        resource_id: job.id,
        details: {
          provider: 'fashn',
          status: 'running',
          provider_job_id: result.jobId,
          isAsync: true,
        },
        ...metadata,
      })
      
      // Return job ID for polling
      return NextResponse.json({
        jobId: job.id,
        providerJobId: result.jobId,
        status: 'running',
        isAsync: true,
        message: 'Job created. Poll /api/tryon/[id] for status.',
      }, { status: 202 }) // 202 Accepted for async operations
    }
    
    // Handle synchronous results
    // Create try-on job records for each result (if using old format)
    if (body.actor_photo_id && body.garment_image_id) {
      const jobs: Array<{ id: string; [key: string]: any }> = []
      for (const tryOnResult of result.results) {
        let resultStoragePath: string | null = null
        
        // Download and store result if it's a URL
        if (tryOnResult.imageUrl) {
          try {
            const response = await fetch(tryOnResult.imageUrl)
            if (response.ok) {
              const blob = await response.blob()
              const buffer = Buffer.from(await blob.arrayBuffer())
              const resultPath = `results/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${tryOnRequest.output_format}`
              const uploadedPath = await uploadFile('tryons', resultPath, buffer)
              if (uploadedPath) {
                resultStoragePath = uploadedPath
              }
            }
          } catch (error) {
            console.error('Error downloading/storing result:', error)
          }
        }
        
        const { data: job, error: jobError } = await supabase
          .from('tryon_jobs')
          .insert({
            actor_photo_id: body.actor_photo_id,
            garment_image_id: body.garment_image_id,
            provider: 'fashn',
            status: 'succeeded',
            result_storage_path: resultStoragePath,
            provider_job_id: tryOnResult.requestId,
            settings: {
              ...tryOnResult.params,
              seed: tryOnResult.seed,
            },
            created_by: user.id,
          })
          .select()
          .single()
        
        if (!jobError && job) {
          jobs.push(job)
        }
      }
      
      // Log audit event
      const metadata = getRequestMetadata(request)
      await logAuditEvent({
        user_id: user.id,
        event_type: 'tryon_created',
        resource_type: 'tryon_job',
        resource_id: jobs[0]?.id || 'unknown',
        details: {
          provider: 'fashn',
          resultsCount: result.results.length,
          duration,
          requestId: result.requestId,
        },
        ...metadata,
      })
      
      // Return results with job IDs
      return NextResponse.json({
        results: result.results.map((r, i) => ({
          ...r,
          jobId: jobs[i]?.id,
        })),
        requestId: result.requestId,
        duration: result.duration,
      }, { status: 201 })
    }
    
    // New format - return results directly
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('[API/tryon/v2] Error:', error)
    console.error('[API/tryon/v2] Error stack:', error.stack)
    console.error('[API/tryon/v2] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    })
    
    // Handle TryOnError
    if (error.code) {
      const tryOnError = error as TryOnError
      const statusMap: Record<TryOnError['code'], number> = {
        MISSING_IMAGES: 400,
        INVALID_INPUT: 400,
        MODERATION_REJECTED: 403,
        API_TIMEOUT: 504,
        RATE_LIMIT: 429,
        API_ERROR: 502,
        UNKNOWN: 500,
      }
      
      return NextResponse.json({
        error: tryOnError.message,
        code: tryOnError.code,
        details: tryOnError.details,
      }, { status: statusMap[tryOnError.code] || 500 })
    }
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json({
      error: error.message || 'Internal server error',
      code: 'UNKNOWN',
    }, { status: 500 })
  }
}

