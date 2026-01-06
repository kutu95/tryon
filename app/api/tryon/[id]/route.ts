import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getTryOnProvider } from '@/src/server/tryon/providers'
import { getSignedUrl, uploadFile, downloadFile } from '@/lib/storage'

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
        // Download result and upload to storage
        const response = await fetch(status.resultUrl)
        if (response.ok) {
          const blob = await response.blob()
          const buffer = Buffer.from(await blob.arrayBuffer())
          const resultPath = `results/${job.id}.jpg`
          
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
            
            job.status = 'succeeded'
            job.result_storage_path = uploadedPath
          }
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

