import NextAuth from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

import { authOptions, enforceLoginRateLimit } from "@/lib/auth";

const handler = NextAuth(authOptions);

type AuthRouteContext = {
  readonly params: Promise<{ readonly nextauth: string[] }>;
};

export function GET(request: NextRequest, context: AuthRouteContext) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const { nextauth } = await context.params;

  if (!isCredentialsCallback(nextauth)) {
    return handler(request, context);
  }

  const credentials = await readCredentials(request.clone());
  const rateLimit = await enforceLoginRateLimit(credentials, request.headers);

  if (!rateLimit.allowed) {
    return createRateLimitResponse(request.nextUrl.origin, rateLimit.retryAfterSeconds);
  }

  return handler(request, context);
}

function isCredentialsCallback(segments: readonly string[]) {
  return segments[0] === "callback" && segments[1] === "credentials";
}

async function readCredentials(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await request.json() as Record<string, unknown>;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await request.text()));
  }

  return undefined;
}

function createRateLimitResponse(origin: string, retryAfterSeconds: number) {
  const errorUrl = new URL("/api/auth/error", origin);
  errorUrl.searchParams.set("error", "RATE_LIMITED");

  return NextResponse.json(
    { url: errorUrl.toString() },
    {
      headers: { "Retry-After": String(retryAfterSeconds) },
      status: 429,
    },
  );
}
