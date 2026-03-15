import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set<string>(["/login", "/registro", "/recuperar-acceso", "/auth/update-password"]);
const PUBLIC_API_PREFIX = ["/api/health"];

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/auth/callback")
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (pathname.startsWith("/api")) {
    if (!isPublicApi(pathname) && !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    return response;
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const publicRoute = isPublicRoute(pathname);

  if (!publicRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
