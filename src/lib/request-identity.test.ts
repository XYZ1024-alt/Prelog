import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";

import {
  getRequestIdentity,
  getTrustedClientAddress,
  hashSensitiveValue,
} from "./request-identity.ts";

const AUTH_SECRET = "request-identity-test-secret";

describe("request identity", () => {
  test("ignores spoofable forwarding headers without a trusted proxy", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.5",
      "x-real-ip": "203.0.113.6",
    });

    expect(getTrustedClientAddress(headers, { trustProxyHeaders: false, vercel: false })).toBeNull();
  });

  test("uses forwarding headers only when proxy trust is explicit", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" });

    expect(getTrustedClientAddress(headers, { trustProxyHeaders: true, vercel: false }))
      .toBe("198.51.100.9");
  });

  test("fails explicitly when production has no trusted client address", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.9" });

    expect(() => getRequestIdentity(headers, "analytics", {
      authSecret: AUTH_SECRET,
      production: true,
      trustProxyHeaders: false,
      vercel: false,
    })).toThrow(/TRUST_PROXY_HEADERS/);
  });

  test("prefers Vercel's protected forwarding header", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.10",
      "x-vercel-forwarded-for": "2001:db8::7",
    });

    expect(getTrustedClientAddress(headers, { vercel: true })).toBe("2001:db8::7");
  });

  test("does not fall back to a spoofable header on Vercel", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.10" });

    expect(getTrustedClientAddress(headers, { vercel: true })).toBeNull();
    expect(() => getRequestIdentity(headers, "analytics", {
      authSecret: AUTH_SECRET,
      production: true,
      vercel: true,
    })).toThrow(/Client IP is unavailable/);
  });

  test("derives identities with HMAC-SHA256", () => {
    const headers = new Headers({ "x-forwarded-for": "8.8.8.8" });
    const identity = getRequestIdentity(headers, "analytics", {
      authSecret: AUTH_SECRET,
      trustProxyHeaders: true,
      vercel: false,
    });
    const expected = createHmac("sha256", AUTH_SECRET)
      .update("request-identity:analytics:ip:8.8.8.8")
      .digest("hex");

    expect(identity).toEqual({ address: "8.8.8.8", hash: expected });
  });

  test("isolates the same address across purpose namespaces", () => {
    const headers = new Headers({ "x-forwarded-for": "8.8.8.8" });
    const options = {
      authSecret: AUTH_SECRET,
      trustProxyHeaders: true,
      vercel: false,
    };

    const namespaces = ["analytics", "comment", "login"] as const;
    const hashes = namespaces.map((namespace) => (
      getRequestIdentity(headers, namespace, options).hash
    ));

    expect(new Set(hashes).size).toBe(3);
  });

  test("requires AUTH_SECRET instead of silently using an unkeyed hash", () => {
    expect(() => hashSensitiveValue("private-value", "")).toThrow(/AUTH_SECRET/);
  });
});
