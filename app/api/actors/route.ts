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
    
    // Get all actors
    const { data: actors, error } = await supabase
      .from('actors')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Supabase error:', error)
      throw error
    }
    
    // Get primary photos for all actors
    const actorIds = actors.map(a => a.id)
    const { data: primaryPhotos } = await supabase
      .from('actor_photos')
      .select('id, actor_id, storage_path')
      .in('actor_id', actorIds)
      .eq('is_primary', true)
    
    // Create a map of actor_id -> primary photo
    const photoMap = new Map()
    primaryPhotos?.forEach(photo => {
      photoMap.set(photo.actor_id, photo)
    })
    
    // Add primary photo to each actor
    const actorsWithPhotos = actors.map(actor => ({
      ...actor,
      primary_photo: photoMap.get(actor.id) || null
    }))
    
    return NextResponse.json(actorsWithPhotos)
  } catch (error: any) {
    console.error('API error:', error)
    // Handle unauthorized errors with 401 instead of 500
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('actors')
      .insert({
        name: body.name,
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
      event_type: 'actor_created',
      resource_type: 'actor',
      resource_id: data.id,
      details: { name: body.name },
      ...metadata,
    })
    
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating actor:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

