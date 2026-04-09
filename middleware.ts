import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Block legacy/debug API routes in production. Source routes may be absent, but
 * stale builds or accidental deploys should not expose DB test handlers.
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  if (
    path === "/api/test-db" ||
    path === "/api/test-insert" ||
    path.startsWith("/command-center") ||
    path.startsWith("/api/command-center") ||
    path.startsWith("/cm-hub") ||
    path.startsWith("/api/cm-hub")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/test-db",
    "/api/test-insert",
    "/command-center/:path*",
    "/api/command-center/:path*",
    "/cm-hub/:path*",
    "/api/cm-hub/:path*",
  ],
};
