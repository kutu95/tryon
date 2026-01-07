import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

/**
 * GET - Fetch audit logs (admin only)
 * Supports pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()
    
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const eventType = searchParams.get('event_type')
    const userId = searchParams.get('user_id')
    
    let query = supabase
      .from('audit_log')
      .select(`
        *,
        user:profiles!user_id(id, display_name, email, role)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    // Get total count for pagination
    let countQuery = supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
    
    if (eventType) {
      countQuery = countQuery.eq('event_type', eventType)
    }
    if (userId) {
      countQuery = countQuery.eq('user_id', userId)
    }
    
    const { count } = await countQuery
    
    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

