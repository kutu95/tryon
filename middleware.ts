import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // For middleware, we need to use the public URL (tunnel) for auth validation
  // because cookies are set via the tunnel URL and need to be validated against the same domain
  // Use the public URL for auth, but we can still use localhost for database queries if needed
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321'
  
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session first - this ensures cookies are properly read and validated
  // This is important when cookies are set via a different domain (tunnel) but validated via localhost
  await supabase.auth.getSession()
  
  // Get both session and user - similar to cashbook pattern
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // Debug logging with detailed cookie info
  const allCookies = request.cookies.getAll()
  const authCookie = allCookies.find(c => c.name.includes('auth-token'))
  console.log('[Middleware]', {
    pathname: request.nextUrl.pathname,
    hasSession: !!session,
    hasUser: !!user,
    sessionError: sessionError?.message,
    userError: userError?.message,
    cookieCount: allCookies.length,
    cookieNames: allCookies.map(c => c.name).join(', '),
    authCookieName: authCookie?.name,
    authCookieValueLength: authCookie?.value?.length || 0,
    supabaseUrl: supabaseUrl
  })

  // Exclude public API routes from authentication
  const publicRoutes = ['/api/storage/proxy']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))
  
  // Protect routes that require authentication
  if ((!user || userError) && !request.nextUrl.pathname.startsWith('/login') && !isPublicRoute) {
    console.log('[Middleware] Redirecting to login - no user found')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/studio'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

