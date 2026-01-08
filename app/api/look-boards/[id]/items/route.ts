import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('look_items')
      .select(`
        *,
        tryon_jobs (
          *,
          actor_photos (*),
          garment_images (*)
        )
      `)
      .eq('look_board_id', params.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[API] Error fetching look items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Always return an array, even if empty
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API] Error in GET /api/look-boards/[id]/items:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('look_items')
      .insert({
        look_board_id: params.id,
        tryon_job_id: body.tryon_job_id,
        label: body.label,
        notes: body.notes,
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

