import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function GET() {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = await createClient()
    
    // Get all garments with creator info
    const { data: garments, error } = await supabase
      .from('garments')
      .select(`
        *,
        creator:profiles!created_by(id, display_name, role)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Get primary images and image counts for all garments
    const garmentIds = garments.map(g => g.id)
    const { data: primaryImages } = await supabase
      .from('garment_images')
      .select('id, garment_id, storage_path')
      .in('garment_id', garmentIds)
      .eq('is_primary', true)
    
    // Get image counts for all garments
    const { data: allImages } = await supabase
      .from('garment_images')
      .select('garment_id')
      .in('garment_id', garmentIds)
    
    // Create maps
    const imageMap = new Map()
    primaryImages?.forEach(image => {
      imageMap.set(image.garment_id, image)
    })
    
    const imageCountMap = new Map()
    allImages?.forEach(image => {
      const count = imageCountMap.get(image.garment_id) || 0
      imageCountMap.set(image.garment_id, count + 1)
    })
    
    // Add primary image and image count to each garment
    const garmentsWithImages = garments.map(garment => ({
      ...garment,
      primary_image: imageMap.get(garment.id) || null,
      image_count: imageCountMap.get(garment.id) || 0
    }))
    
    return NextResponse.json(garmentsWithImages)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = await createClient()
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('garments')
      .insert({
        name: body.name,
        category: body.category,
        notes: body.notes,
        created_by: user.id,
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'garment_created',
      resource_type: 'garment',
      resource_id: data.id,
      details: { name: body.name, category: body.category },
      ...metadata,
    })
    
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

