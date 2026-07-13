import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type RequestHeaders =
  | Pick<Headers, "get">
  | Readonly<Record<string, string | readonly string[] | undefined>>;

type RequestIdentityOptions = {
  readonly authSecret?: string;
  readonly production?: boolean;
  readonly trustProxyHeaders?: boolean;
  readonly vercel?: boolean;
};

export type RequestIdentityNamespace = "analytics" | "comment" | "login";

export type RequestIdentity = {
  readonly address: string | null;
  readonly hash: string;
};

const TRUE_VALUES = new Set(["1", "true"]);

export function getRequestIdentity(
  headers: RequestHeaders,
  namespace: RequestIdentityNamespace,
  options: RequestIdentityOptions = {},
): RequestIdentity {
  const address = getTrustedClientAddress(headers, options);
  const production = options.production ?? process.env.NODE_ENV === "production";

  if (production && !address) {
    throw new Error(
      "Client IP is unavailable in production. Deploy on Vercel or set TRUST_PROXY_HEADERS=true only when the reverse proxy overwrites forwarding headers.",
    );
  }

  return {
    address,
    hash: hashSensitiveValue(
      `request-identity:${namespace}:ip:${address ?? "unresolved"}`,
      options.authSecret,
    ),
  };
}

export function getTrustedClientAddress(
  headers: RequestHeaders,
  options: RequestIdentityOptions = {},
) {
  const vercel = options.vercel ?? process.env.VERCEL === "1";

  if (vercel) {
    return getFirstValidAddress(getHeader(headers, "x-vercel-forwarded-for"));
  }

  const trustProxy = options.trustProxyHeaders ?? isProxyTrustEnabled();

  if (!trustProxy) {
    return null;
  }

  return getFirstValidAddress(getHeader(headers, "x-forwarded-for"))
    ?? getFirstValidAddress(getHeader(headers, "x-real-ip"));
}

export function hashSensitiveValue(value: string, authSecret?: string) {
  const secret = authSecret ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required to derive private request identities.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function isProxyTrustEnabled() {
  return TRUE_VALUES.has(process.env.TRUST_PROXY_HEADERS?.toLowerCase() ?? "");
}

function getFirstValidAddress(value: string | null) {
  if (!value) {
    return null;
  }

  for (const candidate of value.split(",")) {
    const address = normalizeAddress(candidate);

    if (address) {
      return address;
    }
  }

  return null;
}

function normalizeAddress(value: string) {
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function getHeader(headers: RequestHeaders, name: string) {
  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name);
  }

  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return Array.isArray(value) ? value.join(",") : value ?? null;
}
