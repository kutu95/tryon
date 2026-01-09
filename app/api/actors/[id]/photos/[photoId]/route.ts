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
    
    // Check for related try-on jobs (we'll preserve them by setting foreign key to NULL)
    const { data: relatedJobs, error: jobsFetchError } = await supabase
      .from('tryon_jobs')
      .select('id')
      .eq('actor_photo_id', params.photoId)
    
    if (jobsFetchError) {
      console.error('[Delete Photo] Error fetching related jobs:', jobsFetchError)
    } else if (relatedJobs && relatedJobs.length > 0) {
      console.log('[Delete Photo] Found related try-on jobs:', { count: relatedJobs.length })
      console.log('[Delete Photo] Preserving try-on results - foreign keys will be set to NULL')
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

