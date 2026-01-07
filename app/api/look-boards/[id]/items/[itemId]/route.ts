import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentProfile } from '@/lib/auth'

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
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

