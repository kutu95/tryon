import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  if (error || !profile) {
    return null
  }
  
  return profile
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    // In API routes, redirect() throws NEXT_REDIRECT which breaks fetch
    // Instead, throw an error that can be caught and converted to a 401 response
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(allowedRoles: string[]) {
  const profile = await getCurrentProfile()
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/login')
  }
  return profile
}

