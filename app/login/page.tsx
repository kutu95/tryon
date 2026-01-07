'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Attempting login with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out after 10 seconds. Please check if Supabase auth endpoint is accessible via the tunnel.')), 10000)
      )

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      })

      const result = await Promise.race([signInPromise, timeoutPromise]) as any
      
      console.log('Login result:', { 
        hasError: !!result.error, 
        errorMessage: result.error?.message,
        hasUser: !!result.data?.user 
      })

      if (result.error) {
        setError(result.error.message)
        // Log failed login attempt
        try {
          await fetch('/api/audit/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'login_failure',
              details: { email, error: result.error.message },
            }),
          })
        } catch (err) {
          console.error('Failed to log login attempt:', err)
        }
        setLoading(false)
      } else {
        // Login successful - refresh session to ensure cookies are set
        console.log('Login successful, refreshing session...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.getSession()
        
        if (refreshError) {
          console.error('Error refreshing session:', refreshError)
          setError('Login succeeded but session refresh failed. Please try again.')
          setLoading(false)
          return
        }
        
        if (!refreshedSession) {
          console.error('No session after refresh')
          setError('Login succeeded but no session found. Please try again.')
          setLoading(false)
          return
        }
        
        console.log('Session refreshed, redirecting to /studio...')
        
        // Log successful login
        try {
          await fetch('/api/audit/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: refreshedSession.user.id,
              event_type: 'login_success',
              details: { email },
            }),
          })
        } catch (err) {
          console.error('Failed to log login success:', err)
        }
        
        setLoading(false)
        // Use router.replace like cashbook does - it should work now that session is refreshed
        router.replace('/studio')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      })
      setError(err.message || 'Failed to sign in. Please check your connection and ensure Supabase auth endpoint is accessible.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Costume Stylist
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

