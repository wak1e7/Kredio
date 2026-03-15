import { NextRequest, NextResponse } from "next/server";

import { isProductionEnv } from "@/lib/security/runtime";

const BASE_SECURITY_HEADERS: Record<string, string> = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

export function applySecurityHeaders(response: NextResponse) {
  Object.entries(BASE_SECURITY_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value);
  });

  if (isProductionEnv) {
    response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }

  return response;
}

export function validateTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return NextResponse.json({ error: "Solicitud bloqueada por seguridad." }, { status: 403 });
  }

  return null;
}
