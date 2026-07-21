import { NextResponse, type NextRequest } from "next/server";

// Deliberately not importing from "@/lib/auth" here: that module pulls in
// Prisma (native bindings), which has no business loading into the proxy
// bundle. This constant is duplicated on purpose to keep this file's import
// graph tiny.
const SESSION_COOKIE = "session_token";

// Coarse, cookie-presence-only gate: redirects obviously-unauthenticated
// requests away from the app before it even renders. This is a UX
// convenience, not the real security boundary — the session token is only
// validated against the database (expiry, existence) inside getSessionUser,
// called from every page and Server Action. A forged/expired cookie value
// would pass this check but fail there.
const PUBLIC_PATHS = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname === path) ||
    pathname.startsWith("/media/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
