import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    const { target_garment_id } = body

    if (!target_garment_id) {
      return NextResponse.json({ error: 'target_garment_id is required' }, { status: 400 })
    }

    // Verify source image exists and user has access
    const { data: sourceImage, error: sourceError } = await supabase
      .from('garment_images')
      .select('*')
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .single()

    if (sourceError || !sourceImage) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Verify target garment exists and user has access
    const { data: targetGarment, error: targetError } = await supabase
      .from('garments')
      .select('id, created_by')
      .eq('id', target_garment_id)
      .single()

    if (targetError || !targetGarment) {
      return NextResponse.json({ error: 'Target garment not found' }, { status: 404 })
    }

    // Check permissions: user must own source garment or be admin, and must own target garment or be admin
    const { data: sourceGarment } = await supabase
      .from('garments')
      .select('created_by')
      .eq('id', params.id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const ownsSource = sourceGarment?.created_by === user.id
    const ownsTarget = targetGarment.created_by === user.id

    if (!isAdmin && !(ownsSource && ownsTarget)) {
      return NextResponse.json({ error: 'Unauthorized: You can only move images between your own garments' }, { status: 403 })
    }

    // Move the image by updating garment_id
    const { data: movedImage, error: moveError } = await supabase
      .from('garment_images')
      .update({ 
        garment_id: target_garment_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .select()
      .single()

    if (moveError) {
      console.error('[API] Error moving image:', moveError)
      return NextResponse.json(
        { error: 'Failed to move image' },
        { status: 500 }
      )
    }

    return NextResponse.json(movedImage, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error in move image:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
