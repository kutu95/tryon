import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function GET() {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'fashn_api_key')
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }
    
    // If not in database, check environment variable (for initial setup)
    const apiKey = data?.value || process.env.FASHN_API_KEY || ''
    
    // Return masked version (only show last 4 characters)
    const maskedKey = apiKey ? `${'*'.repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}` : ''
    
    return NextResponse.json({ 
      apiKey: maskedKey,
      hasKey: !!apiKey 
    })
  } catch (error: any) {
    console.error('Error fetching FASHN API key:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(['admin'])
    const supabase = await createClient()
    const body = await request.json()
    
    const { apiKey } = body
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }
    
    // Update or insert the API key
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key: 'fashn_api_key',
        value: apiKey.trim(),
        description: 'FASHN AI API Key for virtual try-on service',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      })
      .select()
      .single()
    
    if (error) throw error

    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'fashn_api_key_updated',
      resource_type: 'settings',
      resource_id: data.id,
      details: {},
      ...metadata,
    })
    
    // Return masked version
    const maskedKey = `${'*'.repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}`
    
    return NextResponse.json({ 
      success: true,
      apiKey: maskedKey 
    })
  } catch (error: any) {
    console.error('Error updating FASHN API key:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

