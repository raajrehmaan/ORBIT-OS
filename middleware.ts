import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const publicRoutes = [
    '/login',
    '/signup',
    '/api/auth/signup'
  ]

  const isPublicRoute = publicRoutes.some(
    (route) => pathname.startsWith(route)
  )

  const session =
    req.cookies.get('sb-access-token') ||
    req.cookies.get(
      'supabase-auth-token'
    )

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(
      new URL('/login', req.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
