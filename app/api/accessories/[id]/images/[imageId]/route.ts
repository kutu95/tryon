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
    const { image_type } = body

    if (image_type === undefined) {
      return NextResponse.json({ error: 'image_type field is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('accessory_images')
      .update({ 
        image_type: image_type || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.imageId)
      .eq('accessory_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating accessory image:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

    // Get the image record to find the storage path
    const { data: image, error: fetchError } = await supabase
      .from('accessory_images')
      .select('storage_path')
      .eq('id', params.imageId)
      .eq('accessory_id', params.id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from('accessories')
      .remove([image.storage_path])

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      // Continue anyway - the database record should still be deleted
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('accessory_images')
      .delete()
      .eq('id', params.imageId)
      .eq('accessory_id', params.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting accessory image:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

