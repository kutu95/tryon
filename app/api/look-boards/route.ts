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
    
    const { data, error } = await supabase
      .from('look_boards')
      .select(`
        *,
        creator:profiles!created_by(id, display_name, role)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json(data)
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
      .from('look_boards')
      .insert({
        title: body.title,
        description: body.description,
        created_by: user.id,
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'look_board_created',
      resource_type: 'look_board',
      resource_id: data.id,
      details: { title: body.title },
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

