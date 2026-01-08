import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentProfile } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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
    
    // Delete the look item
    const { error: deleteError } = await supabase
      .from('look_items')
      .delete()
      .eq('id', params.itemId)
      .eq('look_board_id', params.id)
    
    if (deleteError) throw deleteError
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'look_item_deleted',
      resource_type: 'look_item',
      resource_id: params.itemId,
      details: { look_board_id: params.id },
      ...metadata,
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const profile = await getCurrentProfile()
    const body = await request.json()
    const { target_board_id } = body
    
    if (!target_board_id) {
      return NextResponse.json({ error: 'target_board_id is required' }, { status: 400 })
    }
    
    // Verify source item exists
    const { data: sourceItem, error: sourceError } = await supabase
      .from('look_items')
      .select('*, look_boards!inner(created_by)')
      .eq('id', params.itemId)
      .eq('look_board_id', params.id)
      .single()
    
    if (sourceError || !sourceItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    // Verify target board exists
    const { data: targetBoard, error: targetError } = await supabase
      .from('look_boards')
      .select('id, created_by')
      .eq('id', target_board_id)
      .single()
    
    if (targetError || !targetBoard) {
      return NextResponse.json({ error: 'Target board not found' }, { status: 404 })
    }
    
    // Check permissions: user must own source board or be admin/stylist, and must own target board or be admin/stylist
    const sourceBoard = (sourceItem as any).look_boards
    const ownsSource = sourceBoard?.created_by === user.id
    const ownsTarget = targetBoard.created_by === user.id
    const isAdminOrStylist = profile?.role === 'admin' || profile?.role === 'stylist'
    
    if (!isAdminOrStylist && !(ownsSource && ownsTarget)) {
      return NextResponse.json({ 
        error: 'Unauthorized: You can only move items between your own boards' 
      }, { status: 403 })
    }
    
    // Move the item by updating look_board_id
    const { data: movedItem, error: moveError } = await supabase
      .from('look_items')
      .update({ 
        look_board_id: target_board_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.itemId)
      .eq('look_board_id', params.id)
      .select()
      .single()
    
    if (moveError) {
      console.error('[API] Error moving item:', moveError)
      return NextResponse.json(
        { error: 'Failed to move item' },
        { status: 500 }
      )
    }
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'look_item_moved',
      resource_type: 'look_item',
      resource_id: params.itemId,
      details: { 
        source_board_id: params.id,
        target_board_id: target_board_id 
      },
      ...metadata,
    })
    
    return NextResponse.json(movedItem, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error in move item:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
