import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminPath, PUBLIC_ADMIN_PATH, toInternalAdminPath, usesCustomAdminPath } from "@/lib/admin-path";

const INTERNAL_ADMIN_REWRITE_HEADER = "x-prelog-admin-rewrite";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!usesCustomAdminPath()) {
    return NextResponse.next();
  }

  if (isAdminPath(pathname, "/admin")) {
    if (request.headers.get(INTERNAL_ADMIN_REWRITE_HEADER) === PUBLIC_ADMIN_PATH) {
      return NextResponse.next();
    }

    return new NextResponse(null, { status: 404 });
  }

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  const suffix = pathname.slice(PUBLIC_ADMIN_PATH.length);
  const url = request.nextUrl.clone();
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_ADMIN_REWRITE_HEADER, PUBLIC_ADMIN_PATH);
  url.pathname = toInternalAdminPath(suffix);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
