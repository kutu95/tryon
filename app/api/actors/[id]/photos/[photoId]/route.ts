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
    
    // Get the photo record to find the storage path
    const { data: photo, error: fetchError } = await supabase
      .from('actor_photos')
      .select('storage_path')
      .eq('id', params.photoId)
      .eq('actor_id', params.id)
      .single()
    
    if (fetchError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from('actors')
      .remove([photo.storage_path])
    
    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      // Continue anyway - the database record should still be deleted
    }
    
    // Delete the database record
    const { error: deleteError } = await supabase
      .from('actor_photos')
      .delete()
      .eq('id', params.photoId)
      .eq('actor_id', params.id)
    
    if (deleteError) throw deleteError
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting actor photo:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

