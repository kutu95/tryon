import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    // If setting as primary, unset all other primary photos for this actor
    if (body.is_primary === true) {
      // First, unset all primary photos for this actor
      await supabase
        .from('actor_photos')
        .update({ is_primary: false })
        .eq('actor_id', params.id)
      
      // Then set this one as primary
      const { data, error } = await supabase
        .from('actor_photos')
        .update({ is_primary: true })
        .eq('id', params.photoId)
        .eq('actor_id', params.id)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json(data)
    } else {
      // Unset primary
      const { data, error } = await supabase
        .from('actor_photos')
        .update({ is_primary: false })
        .eq('id', params.photoId)
        .eq('actor_id', params.id)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json(data)
    }
  } catch (error: any) {
    console.error('Error updating actor photo:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    console.log('[Delete Photo] Starting deletion:', { actorId: params.id, photoId: params.photoId })
    
    // Get the photo record to find the storage path
    const { data: photo, error: fetchError } = await supabase
      .from('actor_photos')
      .select('storage_path')
      .eq('id', params.photoId)
      .eq('actor_id', params.id)
      .single()
    
    if (fetchError || !photo) {
      console.error('[Delete Photo] Photo not found:', { photoId: params.photoId, error: fetchError })
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    console.log('[Delete Photo] Found photo:', { storagePath: photo.storage_path })
    
    // Check if this photo is used in any try-ons that were saved to look boards
    const { data: relatedJobs, error: jobsFetchError } = await supabase
      .from('tryon_jobs')
      .select(`
        id,
        result_storage_path,
        look_items (id)
      `)
      .eq('actor_photo_id', params.photoId)
    
    if (jobsFetchError) {
      console.error('[Delete Photo] Error fetching related jobs:', jobsFetchError)
      return NextResponse.json(
        { error: 'Failed to check if photo is in use' },
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
        
        console.log('[Delete Photo] Photo is used in saved try-ons:', {
          jobsWithLookItems: jobsWithLookItems.length,
          totalLookItems: lookItemCount
        })
        
        return NextResponse.json(
          { 
            error: 'Cannot delete photo',
            message: `This photo cannot be deleted because it was used to create ${lookItemCount} try-on image${lookItemCount > 1 ? 's' : ''} that ${lookItemCount > 1 ? 'are' : 'is'} saved to look board${lookItemCount > 1 ? 's' : ''}. Please delete the look board items first if you want to remove this photo.`
          },
          { status: 409 } // 409 Conflict
        )
      }
      
      // No look_items found - safe to delete jobs and their results
      console.log('[Delete Photo] Found try-on jobs not saved to look boards:', { count: relatedJobs.length })
      
      // Delete result images from storage
      for (const job of relatedJobs) {
        if (job.result_storage_path) {
          const { error: resultDeleteError } = await adminSupabase.storage
            .from('tryons')
            .remove([job.result_storage_path])
          
          if (resultDeleteError) {
            console.error('[Delete Photo] Error deleting try-on result:', {
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
        .eq('actor_photo_id', params.photoId)
      
      if (jobsDeleteError) {
        console.error('[Delete Photo] Error deleting related jobs:', jobsDeleteError)
        throw jobsDeleteError
      }
      
      console.log('[Delete Photo] Successfully deleted related try-on jobs and results')
    }
    
    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from('actors')
      .remove([photo.storage_path])
    
    if (storageError) {
      console.error('[Delete Photo] Error deleting from storage:', {
        storagePath: photo.storage_path,
        error: storageError.message
      })
      // Continue anyway - we'll still try to delete the database record
    } else {
      console.log('[Delete Photo] Successfully deleted from storage:', photo.storage_path)
    }
    
    // Delete the database record - this is critical and must succeed
    const { error: deleteError, data: deleteData } = await supabase
      .from('actor_photos')
      .delete()
      .eq('id', params.photoId)
      .eq('actor_id', params.id)
      .select()
    
    if (deleteError) {
      console.error('[Delete Photo] Error deleting database record:', {
        photoId: params.photoId,
        error: deleteError.message,
        code: deleteError.code
      })
      throw deleteError
    }
    
    console.log('[Delete Photo] Successfully deleted database record:', { deletedCount: deleteData?.length || 0 })
    
    return NextResponse.json({ success: true, deleted: deleteData })
  } catch (error: any) {
    console.error('[Delete Photo] Exception during deletion:', {
      actorId: params.id,
      photoId: params.photoId,
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

