'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Profile {
  id: string
  display_name?: string
  role: 'admin' | 'stylist' | 'viewer'
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Don't check auth on login page
    if (pathname === '/login') {
      return
    }
    
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error) {
        console.error('Navigation auth check error:', error)
        setUser(null)
        setProfile(null)
        return
      }
      setUser(user)
      
      // Get user profile
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name, role')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }
    }).catch((error) => {
      console.error('Navigation auth check failed:', error)
      setUser(null)
      setProfile(null)
    })
  }, [supabase, pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null
  }

  if (!user) {
    return null
  }

  const navItems = [
    { href: '/studio', label: 'Studio' },
    { href: '/actors', label: 'Actors' },
    { href: '/garments', label: 'Garments' },
    { href: '/accessories', label: 'Accessories' },
    { href: '/boards', label: 'Look Boards' },
    { href: '/account', label: 'Account' },
  ]

  // Add admin-only items
  if (profile?.role === 'admin') {
    navItems.push({ href: '/admin/users', label: 'Users' })
    navItems.push({ href: '/admin/logs', label: 'Logs' })
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/studio" className="text-xl font-bold text-gray-900">
              Costume Stylist
            </Link>
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {profile && (
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                  {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {profile.display_name || user?.email || 'User'}
                </span>
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

