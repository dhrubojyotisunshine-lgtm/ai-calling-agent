import { NextResponse, type NextRequest } from "next/server";

// Fast cookie-presence check only. Real verification happens in requireUser() on every page.
const PUBLIC = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("vx_session");
  const isPublic = PUBLIC.includes(pathname);

  // Signed-in users visiting /login are redirected by the page itself after verifying the cookie,
  // so an expired cookie can't cause a redirect loop here.
  if (!hasSession && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
