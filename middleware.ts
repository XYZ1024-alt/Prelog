import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminPath, PUBLIC_ADMIN_PATH, toInternalAdminPath, usesCustomAdminPath } from "@/lib/admin-path";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!usesCustomAdminPath()) {
    return NextResponse.next();
  }

  if (isAdminPath(pathname, "/admin")) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  const suffix = pathname.slice(PUBLIC_ADMIN_PATH.length);
  const url = request.nextUrl.clone();
  url.pathname = toInternalAdminPath(suffix);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
