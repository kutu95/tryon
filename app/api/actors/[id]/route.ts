import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentProfile } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export { dynamic } from '@/lib/api-force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('actors')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const profile = await getCurrentProfile()
    
    // Get the actor to check permissions
    const { data: actor, error: fetchError } = await supabase
      .from('actors')
      .select('created_by')
      .eq('id', params.id)
      .single()
    
    if (fetchError) throw fetchError
    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 })
    }
    
    // Check if user is creator or admin
    const isCreator = actor.created_by === user.id
    const isAdmin = profile?.role === 'admin'
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('actors')
      .update({
        name: body.name,
        notes: body.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'actor_updated',
      resource_type: 'actor',
      resource_id: params.id,
      details: { name: body.name },
      ...metadata,
    })
    
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const profile = await getCurrentProfile()
    
    // Get the actor to check permissions
    const { data: actor, error: fetchError } = await supabase
      .from('actors')
      .select('created_by')
      .eq('id', params.id)
      .single()
    
    if (fetchError) throw fetchError
    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 })
    }
    
    // Check if user is creator or admin
    const isCreator = actor.created_by === user.id
    const isAdmin = profile?.role === 'admin'
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Check if actor has any photos
    const { data: photos, error: photosError } = await supabase
      .from('actor_photos')
      .select('id')
      .eq('actor_id', params.id)
      .limit(1)
    
    if (photosError) throw photosError
    
    if (photos && photos.length > 0) {
      // Check if any of these photos are used in look boards
      const { data: allPhotos, error: allPhotosError } = await supabase
        .from('actor_photos')
        .select('id')
        .eq('actor_id', params.id)
      
      if (allPhotosError) throw allPhotosError
      
      if (allPhotos && allPhotos.length > 0) {
        const photoIds = allPhotos.map(p => p.id)
        
        // Check if any tryon_jobs using these photos are saved to look boards
        const { data: jobsInLookBoards, error: jobsError } = await supabase
          .from('tryon_jobs')
          .select(`
            id,
            look_items!inner (id)
          `)
          .in('actor_photo_id', photoIds)
          .limit(1)
        
        if (jobsError) throw jobsError
        
        if (jobsInLookBoards && jobsInLookBoards.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot delete actor used in look boards',
              message: 'This actor is used in one or more look boards. Please remove the actor from all look boards before deleting.'
            },
            { status: 409 }
          )
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Cannot delete actor with photos',
          message: 'This actor has photos. Please delete all photos before deleting the actor.'
        },
        { status: 409 }
      )
    }
    
    // Safe to delete - no photos and not in any look boards
    const { error } = await supabase
      .from('actors')
      .delete()
      .eq('id', params.id)
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'actor_deleted',
      resource_type: 'actor',
      resource_id: params.id,
      ...metadata,
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting actor:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

