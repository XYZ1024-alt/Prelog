import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const PREVIEW_TOKEN_BYTES = 32;
const PREVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const previewTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function createPostPreviewToken(now = new Date()) {
  const token = randomBytes(PREVIEW_TOKEN_BYTES).toString("base64url");
  return {
    expiresAt: new Date(now.getTime() + PREVIEW_TOKEN_TTL_MS),
    token,
    tokenHash: hashPostPreviewToken(token),
  };
}

export function hashPostPreviewToken(value: string) {
  const token = previewTokenSchema.parse(value);
  return createHash("sha256").update(token).digest("hex");
}
