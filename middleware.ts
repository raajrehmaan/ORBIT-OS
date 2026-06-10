import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const publicRoutes = [
    '/login',
    '/signup',
    '/api/auth/signup',
    '/_next',
    '/favicon.ico'
  ]

  const isPublicRoute = publicRoutes.some(
    (route) => pathname.startsWith(route)
  )

  if (isPublicRoute) {
    return NextResponse.next()
  }

  const session =
    req.cookies.get('sb-access-token') ||
    req.cookies.get('supabase-auth-token')

  if (!session) {
    return NextResponse.redirect(
      new URL('/login', req.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\.).*)']
}
