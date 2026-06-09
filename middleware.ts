import { NextResponse, type NextRequest } from "next/server";
import { clinicSessionCookieName, verifyClinicSessionValue } from "@/lib/auth/session-token";

export async function middleware(request: NextRequest) {
  const session = await verifyClinicSessionValue(request.cookies.get(clinicSessionCookieName)?.value ?? "");
  const isAuthenticated = Boolean(session);
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const protectedPath = !isLoginRoute && !isAuthRoute;

  if (isLoginRoute && isAuthenticated) {
    const nextPath = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(safeRedirectUrl(nextPath, request.url));
  }

  if (protectedPath && !isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (request.nextUrl.pathname === "/" && isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
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
