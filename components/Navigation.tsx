'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

interface Profile {
  id: string
  display_name?: string
  role: 'admin' | 'stylist' | 'viewer'
  profile_picture_path?: string
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false)
      }
    }

    if (adminMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [adminMenuOpen])

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
          .select('id, display_name, role, profile_picture_path')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
        
        // Fetch profile picture URL if it exists
        if (profileData?.profile_picture_path) {
          try {
            const urlResponse = await fetch(
              `/api/storage/signed-url?bucket=profiles&path=${encodeURIComponent(profileData.profile_picture_path)}`
            )
            if (urlResponse.ok) {
              const { url } = await urlResponse.json()
              setProfilePictureUrl(url)
            }
          } catch (error) {
            console.error('Error fetching profile picture URL:', error)
          }
        } else {
          setProfilePictureUrl(null)
        }
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
  ]

  const isAdmin = profile?.role === 'admin'
  const adminItems = isAdmin ? [
    { href: '/account', label: 'Account' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/logs', label: 'Logs' },
  ] : []

  const isActive = (href: string) => pathname === href
  const isAdminActive = adminItems.some(item => isActive(item.href))

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Desktop Menu */}
          <div className="flex items-center space-x-8">
            <Link href="/studio" className="text-xl font-bold text-gray-900">
              Costume Stylist
            </Link>
            {/* Desktop Menu - Hidden on mobile */}
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(item.href)
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {/* Admin Dropdown - Desktop */}
              {isAdmin && (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 ${
                      isAdminActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Admin
                    <svg
                      className={`w-4 h-4 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {adminMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                      {adminItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAdminMenuOpen(false)}
                          className={`block px-4 py-2 text-sm ${
                            isActive(item.href)
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Profile and Sign Out */}
          <div className="flex items-center gap-4">
            {profile && (
              <Link
                href="/profile"
                className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover border border-gray-300"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                    {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">
                  {profile.display_name || user?.email || 'User'}
                </span>
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Sign Out
            </button>
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 rounded-md text-base font-medium ${
                    isActive(item.href)
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {/* Admin Section - Mobile */}
              {isAdmin && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admin
                  </div>
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-2 rounded-md text-base font-medium ${
                        isActive(item.href)
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
              {/* Profile and Sign Out - Mobile */}
              {profile && (
                <>
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      {profilePictureUrl ? (
                        <img
                          src={profilePictureUrl}
                          alt="Profile"
                          className="w-8 h-8 rounded-full object-cover border border-gray-300"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                          {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span>{profile.display_name || user?.email || 'User'}</span>
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        handleSignOut()
                      }}
                      className="w-full text-left px-4 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

