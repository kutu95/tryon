import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'
import { getSignedUrl } from '@/lib/storage'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (error) throw error
    
    // Get profile picture URL if it exists
    let profilePictureUrl = null
    if (profile.profile_picture_path) {
      profilePictureUrl = await getSignedUrl('profiles', profile.profile_picture_path)
    }
    
    return NextResponse.json({
      ...profile,
      email: user.email,
      profile_picture_url: profilePictureUrl,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    const { display_name } = body
    
    if (!display_name || display_name.trim() === '') {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: display_name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()
    
    if (error) throw error
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'profile_updated',
      resource_type: 'profile',
      resource_id: user.id,
      details: { display_name },
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

