import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'

// PUT - Update user role or profile (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])
    const adminSupabase = createAdminClient() // Use admin client to bypass RLS
    const body = await request.json()
    
    const { role, display_name } = body
    
    if (role && !['admin', 'stylist', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, stylist, or viewer' },
        { status: 400 }
      )
    }
    
    // Update profile using admin client (bypasses RLS)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }
    
    if (role !== undefined) {
      updateData.role = role
    }
    
    if (display_name !== undefined) {
      updateData.display_name = display_name
    }
    
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()
    
    if (profileError) {
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await adminSupabase
          .from('profiles')
          .insert({
            id: params.id,
            role: role || 'viewer',
            display_name: display_name || null,
          })
          .select()
          .single()
        
        if (createError) {
          throw createError
        }
        
        return NextResponse.json(newProfile)
      }
      throw profileError
    }
    
    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('Error in PUT /api/admin/users/[id]:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])
    const adminSupabase = createAdminClient()
    
    // Delete user via admin API (this will cascade delete the profile due to ON DELETE CASCADE)
    const { error } = await adminSupabase.auth.admin.deleteUser(params.id)
    
    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete user' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/users/[id]:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

