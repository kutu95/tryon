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
      .from('look_boards')
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
    
    // Get the board to check permissions
    const { data: board, error: fetchError } = await supabase
      .from('look_boards')
      .select('created_by')
      .eq('id', params.id)
      .single()
    
    if (fetchError) throw fetchError
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }
    
    // Check if user is creator or admin
    const isCreator = board.created_by === user.id
    const isAdmin = profile?.role === 'admin'
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await request.json()
    const { title, description } = body
    
    const { data, error } = await supabase
      .from('look_boards')
      .update({
        title: title,
        description: description,
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
      event_type: 'look_board_updated',
      resource_type: 'look_board',
      resource_id: params.id,
      details: { title },
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
    
    // Get the board to check permissions and count items
    const { data: board, error: fetchError } = await supabase
      .from('look_boards')
      .select('created_by, title')
      .eq('id', params.id)
      .single()
    
    if (fetchError) throw fetchError
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }
    
    // Check if user is creator or admin
    const isCreator = board.created_by === user.id
    const isAdmin = profile?.role === 'admin'
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Count items in the board
    const { count, error: countError } = await supabase
      .from('look_items')
      .select('*', { count: 'exact', head: true })
      .eq('look_board_id', params.id)
    
    if (countError) throw countError
    
    // Delete the board (items will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('look_boards')
      .delete()
      .eq('id', params.id)
    
    if (deleteError) throw deleteError
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'look_board_deleted',
      resource_type: 'look_board',
      resource_id: params.id,
      details: { title: board.title, items_count: count || 0 },
      ...metadata,
    })
    
    return NextResponse.json({ 
      success: true,
      items_deleted: count || 0 
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
