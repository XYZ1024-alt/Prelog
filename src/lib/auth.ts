import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { toAdminPath } from "@/lib/admin-path";
import { ADMIN_USER_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, type RateLimitPolicy, type RateLimitResult } from "@/lib/rate-limit";
import { getRequestIdentity, hashSensitiveValue, type RequestHeaders } from "@/lib/request-identity";
import { loginSchema } from "@/lib/validation";

export const LOGIN_RATE_LIMIT_POLICIES = {
  account: { limit: 20, windowMs: 15 * 60 * 1000 },
  address: { limit: 8, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitPolicy>;

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: toAdminPath("/login"),
  },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { id: ADMIN_USER_ID },
        });

        if (!user || user.role !== "ADMIN" || user.email !== parsed.data.email) {
          return null;
        }

        const validPassword = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );

        if (!validPassword) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
      }

      return session;
    },
  },
};

export async function enforceLoginRateLimit(
  credentials: Record<string, unknown> | undefined,
  requestHeaders: RequestHeaders,
): Promise<RateLimitResult> {
  const identity = getRequestIdentity(requestHeaders, "login");
  const addressResult = await consumeRateLimit({
    ...LOGIN_RATE_LIMIT_POLICIES.address,
    key: `login:address:${identity.hash}`,
  });

  if (!addressResult.allowed) {
    return addressResult;
  }

  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    return addressResult;
  }

  const accountHash = hashSensitiveValue(`login-account:${parsed.data.email.toLowerCase()}`);
  return consumeRateLimit({
    ...LOGIN_RATE_LIMIT_POLICIES.account,
    key: `login:account:${accountHash}`,
  });
}
