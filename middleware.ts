import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const protectedPath = !isLoginRoute && !isAuthRoute;

  if (isLoginRoute && user) {
    const nextPath = request.nextUrl.searchParams.get("next");
    const redirectUrl = safeRedirectUrl(nextPath, request.url);
    return redirectWithCookies(redirectUrl, response);
  }

  if (protectedPath && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(redirectUrl, response);
  }

  if (request.nextUrl.pathname === "/" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return redirectWithCookies(redirectUrl, response);
  }

  return response;
}

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

function safeRedirectUrl(nextPath: string | null, requestUrl: string) {
  if (!nextPath?.startsWith("/") || nextPath.startsWith("//")) {
    return new URL("/dashboard", requestUrl);
  }

  return new URL(nextPath, requestUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
