import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'

// GET - List all users (admin only)
export async function GET() {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Get all users from auth.users (handle pagination)
    let allUsers: any[] = []
    let page = 1
    let hasMore = true
    
    while (hasMore) {
      const { data, error: usersError } = await adminSupabase.auth.admin.listUsers({
        page,
        perPage: 1000, // Get as many as possible per page
      })
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
        throw usersError
      }
      
      if (data.users && data.users.length > 0) {
        allUsers = [...allUsers, ...data.users]
        hasMore = data.users.length === 1000 // If we got a full page, there might be more
        page++
      } else {
        hasMore = false
      }
    }
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }
    
    // Combine user and profile data
    const usersWithProfiles = allUsers.map(user => {
      const profile = profiles?.find(p => p.id === user.id)
      return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        role: profile?.role || 'viewer',
        display_name: profile?.display_name || user.email,
        profile_created_at: profile?.created_at,
      }
    })
    
    return NextResponse.json(usersWithProfiles)
  } catch (error: any) {
    console.error('Error in GET /api/admin/users:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])
    const adminSupabase = createAdminClient()
    const body = await request.json()
    
    const { email, password, role, display_name } = body
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    // Create user via admin API
    const { data: userData, error: userError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    
    if (userError) {
      console.error('Error creating user:', userError)
      return NextResponse.json(
        { error: userError.message || 'Failed to create user' },
        { status: 500 }
      )
    }
    
    // Create or update profile with specified role
    const supabase = await createClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.user.id,
        role: role || 'viewer',
        display_name: display_name || email,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (profileError) {
      console.error('Error creating profile:', profileError)
      // User was created but profile failed - this is not ideal but user exists
      return NextResponse.json(
        { 
          error: 'User created but profile creation failed',
          details: profileError.message,
          user: userData.user
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      ...userData.user,
      role: profile.role,
      display_name: profile.display_name,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/users:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

