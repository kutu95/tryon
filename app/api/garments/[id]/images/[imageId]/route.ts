import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

