import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

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
    await requireAuth()
    const supabase = await createClient()
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
    
    return NextResponse.json(data)
  } catch (error: any) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

