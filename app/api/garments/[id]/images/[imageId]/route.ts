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
    
    // Delete from storage first
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
