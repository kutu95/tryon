import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getTryOnProvider } from '@/src/server/tryon/providers'
import { getSignedUrl, uploadFile, downloadFile } from '@/lib/storage'
import { postprocessTryOnImage, type OpenAIImageOptions } from '@/lib/server/openaiImage'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data: job, error } = await supabase
      .from('tryon_jobs')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (error) throw error
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    // If job is async and still running, check status with provider
    if (job.provider_job_id && (job.status === 'queued' || job.status === 'running')) {
      const provider = getTryOnProvider()
      const status = await provider.getTryOnStatus({ jobId: job.provider_job_id })
      
      if (status.status === 'succeeded' && status.resultUrl) {
        console.log('[Try-on Status] Downloading result from:', status.resultUrl)
        // Download result and upload to storage
        try {
          const response = await fetch(status.resultUrl)
          if (!response.ok) {
            console.error('[Try-on Status] Failed to download result:', {
              status: response.status,
              statusText: response.statusText,
              url: status.resultUrl
            })
            throw new Error(`Failed to download result: ${response.status} ${response.statusText}`)
          }
          
          const blob = await response.blob()
          const arrayBuffer = await blob.arrayBuffer()
          let buffer: Buffer = Buffer.from(arrayBuffer)
          
          // Apply OpenAI postprocess if enabled in job settings
          const settings = job.settings as any
          if (settings?.openaiPostprocess) {
            try {
              console.log('[Try-on Status] Applying OpenAI postprocess...')
              const postprocessOptions: OpenAIImageOptions = {
                model: settings.openaiPostprocess.model || 'gpt-image-1-mini',
                quality: settings.openaiPostprocess.quality || 'medium',
                size: settings.openaiPostprocess.size || '1024x1024',
                requestId: `postprocess-${job.id}-${Date.now()}`,
                timeoutMs: 90000,
                retries: 2,
                maskExpandPx: settings.openaiPostprocess.maskExpandPx,
              }
              const postprocessedBuffer = await postprocessTryOnImage(buffer, postprocessOptions)
              buffer = Buffer.from(postprocessedBuffer) as Buffer
              console.log('[Try-on Status] OpenAI postprocess completed')
            } catch (error: any) {
              console.error('[Try-on Status] OpenAI postprocess failed, using raw FASHN result:', error.message)
              // Continue with raw FASHN result if postprocess fails
            }
          }
          
          const resultPath = `results/${job.id}.jpg`
          
          console.log('[Try-on Status] Uploading result to storage:', resultPath)
          const uploadedPath = await uploadFile('tryons', resultPath, buffer)
          
          if (uploadedPath) {
            console.log('[Try-on Status] Result uploaded successfully:', uploadedPath)
            await supabase
              .from('tryon_jobs')
              .update({
                status: 'succeeded',
                result_storage_path: uploadedPath,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id)
            
            job.status = 'succeeded'
            job.result_storage_path = uploadedPath
          } else {
            console.error('[Try-on Status] Failed to upload result to storage')
          }
        } catch (downloadError: any) {
          console.error('[Try-on Status] Error downloading/uploading result:', downloadError)
          // Don't fail the request, but log the error
        }
      } else if (status.status === 'failed') {
        await supabase
          .from('tryon_jobs')
          .update({
            status: 'failed',
            error_message: status.error || 'Provider returned failed status',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        
        job.status = 'failed'
        job.error_message = status.error
      } else {
        // Update status if changed
        if (status.status !== job.status) {
          await supabase
            .from('tryon_jobs')
            .update({
              status: status.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          
          job.status = status.status
        }
      }
    }
    
    // Generate signed URL for result if available
    let resultUrl = null
    if (job.result_storage_path) {
      resultUrl = await getSignedUrl('tryons', job.result_storage_path)
    }
    
    return NextResponse.json({
      ...job,
      result_url: resultUrl,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

