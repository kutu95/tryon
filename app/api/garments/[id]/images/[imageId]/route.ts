import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    const { image_type, is_primary } = body

    // Handle primary image update
    if (is_primary !== undefined) {
      // If setting this image as primary, unset all other primary images for this garment
      if (is_primary) {
        const { error: unsetError } = await supabase
          .from('garment_images')
          .update({ is_primary: false })
          .eq('garment_id', params.id)
          .eq('is_primary', true)

        if (unsetError) throw unsetError
      }

      // Set the target image's primary status
      const { data, error } = await supabase
        .from('garment_images')
        .update({ 
          is_primary: is_primary,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.imageId)
        .eq('garment_id', params.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    // Handle image_type update
    if (image_type === undefined) {
      return NextResponse.json({ error: 'image_type or is_primary field is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('garment_images')
      .update({ 
        image_type: image_type || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating garment image:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    console.log('[Delete Image] Starting deletion:', { garmentId: params.id, imageId: params.imageId })
    
    // Get the image record to find the storage path
    const { data: image, error: fetchError } = await supabase
      .from('garment_images')
      .select('storage_path')
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .single()
    
    if (fetchError || !image) {
      console.error('[Delete Image] Image not found:', { imageId: params.imageId, error: fetchError })
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
    
    console.log('[Delete Image] Found image:', { storagePath: image.storage_path })
    
    // Check if this image is used in any try-ons that were saved to look boards
    const { data: relatedJobs, error: jobsFetchError } = await supabase
      .from('tryon_jobs')
      .select(`
        id,
        result_storage_path,
        look_items (id)
      `)
      .eq('garment_image_id', params.imageId)
    
    if (jobsFetchError) {
      console.error('[Delete Image] Error fetching related jobs:', jobsFetchError)
      return NextResponse.json(
        { error: 'Failed to check if image is in use' },
        { status: 500 }
      )
    }
    
    if (relatedJobs && relatedJobs.length > 0) {
      // Check if any jobs have associated look_items (saved to look boards)
      const jobsWithLookItems = relatedJobs.filter((job: any) => 
        job.look_items && job.look_items.length > 0
      )
      
      if (jobsWithLookItems.length > 0) {
        const lookItemCount = jobsWithLookItems.reduce((sum: number, job: any) => 
          sum + (job.look_items?.length || 0), 0
        )
        
        console.log('[Delete Image] Image is used in saved try-ons:', {
          jobsWithLookItems: jobsWithLookItems.length,
          totalLookItems: lookItemCount
        })
        
        return NextResponse.json(
          { 
            error: 'Cannot delete image',
            message: `This image cannot be deleted because it was used to create ${lookItemCount} try-on image${lookItemCount > 1 ? 's' : ''} that ${lookItemCount > 1 ? 'are' : 'is'} saved to look board${lookItemCount > 1 ? 's' : ''}. Please delete the look board items first if you want to remove this image.`
          },
          { status: 409 } // 409 Conflict
        )
      }
      
      // No look_items found - safe to delete jobs and their results
      console.log('[Delete Image] Found try-on jobs not saved to look boards:', { count: relatedJobs.length })
      
      // Delete result images from storage
      for (const job of relatedJobs) {
        if (job.result_storage_path) {
          const { error: resultDeleteError } = await adminSupabase.storage
            .from('tryons')
            .remove([job.result_storage_path])
          
          if (resultDeleteError) {
            console.error('[Delete Image] Error deleting try-on result:', {
              jobId: job.id,
              path: job.result_storage_path,
              error: resultDeleteError.message
            })
          }
        }
      }
      
      // Delete the try-on jobs (they weren't saved to look boards)
      const { error: jobsDeleteError } = await supabase
        .from('tryon_jobs')
        .delete()
        .eq('garment_image_id', params.imageId)
      
      if (jobsDeleteError) {
        console.error('[Delete Image] Error deleting related jobs:', jobsDeleteError)
        throw jobsDeleteError
      }
      
      console.log('[Delete Image] Successfully deleted related try-on jobs and results')
    }
    
    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from('garments')
      .remove([image.storage_path])
    
    if (storageError) {
      console.error('[Delete Image] Error deleting from storage:', {
        storagePath: image.storage_path,
        error: storageError.message
      })
      // Continue anyway - we'll still try to delete the database record
    } else {
      console.log('[Delete Image] Successfully deleted from storage:', image.storage_path)
    }
    
    // Delete the database record - this is critical and must succeed
    const { error: deleteError, data: deleteData } = await supabase
      .from('garment_images')
      .delete()
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .select()
    
    if (deleteError) {
      console.error('[Delete Image] Error deleting database record:', {
        imageId: params.imageId,
        error: deleteError.message,
        code: deleteError.code
      })
      throw deleteError
    }
    
    console.log('[Delete Image] Successfully deleted database record:', { deletedCount: deleteData?.length || 0 })
    
    return NextResponse.json({ success: true, deleted: deleteData })
  } catch (error: any) {
    console.error('[Delete Image] Exception during deletion:', {
      garmentId: params.id,
      imageId: params.imageId,
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}
