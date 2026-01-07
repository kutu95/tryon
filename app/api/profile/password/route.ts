import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    
    const { currentPassword, newPassword } = body
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }
    
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      )
    }
    
    // First, verify the current password by attempting to sign in
    // Note: Supabase doesn't have a direct "verify password" method,
    // so we need to use signInWithPassword to verify
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })
    
    if (verifyError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }
    
    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    
    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 500 }
      )
    }
    
    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'password_changed',
      resource_type: 'auth',
      resource_id: user.id,
      details: {},
      ...metadata,
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

