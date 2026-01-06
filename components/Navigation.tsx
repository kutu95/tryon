'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    // Don't check auth on login page
    if (pathname === '/login') {
      return
    }
    
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error('Navigation auth check error:', error)
        setUser(null)
        return
      }
      setUser(user)
    }).catch((error) => {
      console.error('Navigation auth check failed:', error)
      setUser(null)
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
    { href: '/boards', label: 'Look Boards' },
    { href: '/account', label: 'Account' },
  ]

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
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  )
}

