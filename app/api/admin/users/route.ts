import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'

// GET - List all users (admin only)
export async function GET() {
  try {
    await requireRole(['admin'])
    const adminSupabase = createAdminClient()
    
    console.log('[Admin Users] Starting to fetch users...')
    console.log('[Admin Users] SUPABASE_URL:', process.env.SUPABASE_URL)
    console.log('[Admin Users] Has service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Get all users from auth.users (handle pagination)
    let allUsers: any[] = []
    let page = 1
    let hasMore = true
    
    try {
      while (hasMore) {
        console.log(`[Admin Users] Fetching page ${page}...`)
        const { data, error: usersError } = await adminSupabase.auth.admin.listUsers({
          page,
          perPage: 1000, // Get as many as possible per page
        })
        
        if (usersError) {
          console.error('[Admin Users] Error fetching users:', usersError)
          console.error('[Admin Users] Error details:', {
            message: usersError.message,
            status: usersError.status,
            name: usersError.name,
          })
          throw usersError
        }
        
        console.log(`[Admin Users] Page ${page} returned ${data?.users?.length || 0} users`)
        
        if (data?.users && data.users.length > 0) {
          allUsers = [...allUsers, ...data.users]
          hasMore = data.users.length === 1000 // If we got a full page, there might be more
          page++
        } else {
          hasMore = false
        }
      }
    } catch (authError: any) {
      console.error('[Admin Users] Auth admin API error:', authError)
      throw new Error(`Failed to fetch users from auth API: ${authError.message || authError}`)
    }
    
    console.log(`[Admin Users] Fetched ${allUsers.length} total users`)
    
    // Get all profiles using admin client to bypass RLS
    console.log('[Admin Users] Fetching profiles...')
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('*')
    
    if (profilesError) {
      console.error('[Admin Users] Error fetching profiles:', profilesError)
      console.error('[Admin Users] Profile error details:', {
        message: profilesError.message,
        details: profilesError.details,
        hint: profilesError.hint,
        code: profilesError.code,
      })
      throw profilesError
    }
    
    console.log(`[Admin Users] Fetched ${profiles?.length || 0} profiles`)
    
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
    
    console.log(`[Admin Users] Returning ${usersWithProfiles.length} users with profiles`)
    return NextResponse.json(usersWithProfiles)
  } catch (error: any) {
    console.error('[Admin Users] Error in GET /api/admin/users:', error)
    console.error('[Admin Users] Error stack:', error.stack)
    console.error('[Admin Users] Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    })
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null,
    }, { status: 500 })
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
    
    // Create or update profile with specified role using admin client
    const { data: profile, error: profileError } = await adminSupabase
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

