import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentProfile } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('garments')
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
    
    // Get the garment to check permissions
    const { data: garment, error: fetchError } = await supabase
      .from('garments')
      .select('created_by')
      .eq('id', params.id)
      .single()
    
    if (fetchError) throw fetchError
    if (!garment) {
      return NextResponse.json({ error: 'Garment not found' }, { status: 404 })
    }
    
    // Check if user is creator or admin
    const isCreator = garment.created_by === user.id
    const isAdmin = profile?.role === 'admin'
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('garments')
      .update({
        name: body.name,
        category: body.category,
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
      event_type: 'garment_updated',
      resource_type: 'garment',
      resource_id: params.id,
      details: { name: body.name, category: body.category },
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
    
    const { error } = await supabase
      .from('garments')
      .delete()
      .eq('id', params.id)
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'garment_deleted',
      resource_type: 'garment',
      resource_id: params.id,
      ...metadata,
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

