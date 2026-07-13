import { BlockList, isIP } from "node:net";

import { z } from "zod";

import { PUBLIC_SEARCH_QUERY_MAX } from "@/lib/constants";

const REQUIRED_TEXT_MIN = 1;
const DATABASE_ID_MAX = 64;
const TITLE_MAX = 120;
const SLUG_MAX = 140;
const EXCERPT_MAX = 300;
const COMMENT_MAX = 1200;
const PASSWORD_MIN = 8;
const PATH_MAX = 2048;
const REFERRER_MAX = 2048;
const TEXTAREA_MAX = 2000;
const HTTPS_PROTOCOL = "https:";
const HTTP_PROTOCOLS = new Set(["http:", HTTPS_PROTOCOL]);
const ANALYTICS_PATH_PATTERN = /^\/(?!\/)[^?#\\\u0000-\u001f]*$/;
const DATABASE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const NON_PUBLIC_ADDRESSES = createNonPublicAddressList();
const MANUAL_COVER_HOSTS_SEPARATOR = ",";
const PUBLIC_URL_ERROR = "封面图 URL 必须使用允许列表中的公开 HTTPS 主机。";

export const publicHttpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(isAllowedManualCoverUrl, PUBLIC_URL_ERROR);

const optionalHttpsUrlSchema = publicHttpsUrlSchema
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(PASSWORD_MIN),
});

export const adminProfileSchema = z
  .object({
    email: z.email(),
    name: z.string().trim().max(TITLE_MAX).optional().or(z.literal("")),
    currentPassword: z.string().min(PASSWORD_MIN),
    newPassword: z.string().optional().or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (!value.newPassword && !value.confirmPassword) {
      return;
    }

    if ((value.newPassword?.length ?? 0) < PASSWORD_MIN) {
      context.addIssue({
        code: "custom",
        message: `新密码至少 ${PASSWORD_MIN} 位。`,
        path: ["newPassword"],
      });
    }

    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "两次输入的新密码不一致。",
        path: ["confirmPassword"],
      });
    }
  });

export const postFormSchema = z
  .object({
    title: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
    slug: z.string().trim().min(REQUIRED_TEXT_MIN).max(SLUG_MAX),
    excerpt: z.string().trim().max(EXCERPT_MAX).optional(),
    content: z.string().trim().min(REQUIRED_TEXT_MIN),
    coverMode: z.enum(["GLYPH", "MANUAL"]),
    coverImage: optionalHttpsUrlSchema,
    categoryId: z.string().trim().optional().or(z.literal("")),
    tagNames: z.string().trim().optional(),
    seoTitle: z.string().trim().max(TITLE_MAX).optional(),
    seoDescription: z.string().trim().max(EXCERPT_MAX).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  })
  .superRefine((value, context) => {
    if (value.coverMode === "MANUAL" && !value.coverImage) {
      context.addIssue({
        code: "custom",
        message: "人工封面模式必须提供 HTTPS 图片 URL。",
        path: ["coverImage"],
      });
    }
  });

export const categoryFormSchema = z.object({
  name: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  slug: z.string().trim().min(REQUIRED_TEXT_MIN).max(SLUG_MAX),
  description: z.string().trim().max(EXCERPT_MAX).optional(),
});

export const commentSchema = z.object({
  postId: z.string().trim().min(REQUIRED_TEXT_MIN).max(DATABASE_ID_MAX).regex(DATABASE_ID_PATTERN),
  slug: z.string().trim().min(REQUIRED_TEXT_MIN).max(SLUG_MAX),
  parentId: z.string().trim().max(DATABASE_ID_MAX).regex(DATABASE_ID_PATTERN).optional().or(z.literal("")),
  author: z.string().trim().min(REQUIRED_TEXT_MIN).max(80),
  email: z.email(),
  body: z.string().trim().min(REQUIRED_TEXT_MIN).max(COMMENT_MAX),
  website: z.string().max(0).optional(),
});

export const idSchema = z.object({
  id: z.string().trim().min(REQUIRED_TEXT_MIN).max(DATABASE_ID_MAX).regex(DATABASE_ID_PATTERN),
});

const analyticsBaseSchema = z.object({
  path: z.string().trim().min(REQUIRED_TEXT_MIN).max(PATH_MAX).regex(ANALYTICS_PATH_PATTERN),
});
const analyticsSearchQuerySchema = z.string()
  .transform(normalizeSearchQuery)
  .pipe(z.string().min(REQUIRED_TEXT_MIN).max(PUBLIC_SEARCH_QUERY_MAX));

export const publicSearchQuerySchema = z.string().trim().max(PUBLIC_SEARCH_QUERY_MAX);

export const analyticsSchema = z.discriminatedUnion("type", [
  analyticsBaseSchema.extend({
    type: z.literal("PAGE_VIEW"),
    referrer: z.string().trim().max(REFERRER_MAX).refine(isOptionalHttpUrl).optional().or(z.literal("")),
  }).strict(),
  analyticsBaseSchema.extend({
    type: z.literal("READ_DEPTH"),
    depth: z.enum(["25", "50", "90"]),
  }).strict(),
  analyticsBaseSchema.extend({ query: analyticsSearchQuerySchema, type: z.literal("SEARCH") }).strict(),
  analyticsBaseSchema.extend({ query: analyticsSearchQuerySchema, type: z.literal("SEARCH_ZERO") }).strict(),
]);

export const siteSettingsSchema = z.object({
  siteName: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  siteTagline: z.string().trim().min(REQUIRED_TEXT_MIN).max(EXCERPT_MAX),
  heroTitle: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  heroExcerpt: z.string().trim().min(REQUIRED_TEXT_MIN).max(EXCERPT_MAX),
  aboutTitle: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  aboutIntro: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  aboutWriting: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  aboutAudience: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  aboutTopics: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  footerPrimary: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  footerSecondary: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
});

export function isAllowedManualCoverUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

    if (
      url.protocol !== HTTPS_PROTOCOL
      || url.username
      || url.password
      || !isPublicHostname(hostname)
      || !isAllowedManualCoverHostname(hostname)
    ) {
      return false;
    }

    const ipVersion = isIP(hostname);
    return ipVersion === 0 || !NON_PUBLIC_ADDRESSES.check(hostname, ipVersion === 4 ? "ipv4" : "ipv6");
  } catch {
    return false;
  }
}

function isAllowedManualCoverHostname(hostname: string) {
  const configuredHosts = getConfiguredManualCoverHosts();

  if (configuredHosts.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  return configuredHosts.includes(hostname);
}

export function getConfiguredManualCoverHosts() {
  return (process.env.MANUAL_COVER_HOSTS ?? "")
    .split(MANUAL_COVER_HOSTS_SEPARATOR)
    .map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

function isPublicHostname(hostname: string) {
  if (
    !hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.startsWith("::ffff:")
  ) {
    return false;
  }

  return isIP(hostname) > 0 || hostname.includes(".");
}

function isOptionalHttpUrl(value: string) {
  if (!value) {
    return true;
  }

  try {
    return HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function normalizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function createNonPublicAddressList() {
  const addresses = new BlockList();
  const ipv4Subnets = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
  ] as const;
  const ipv6Subnets = [
    ["::", 128], ["::1", 128], ["100::", 64],
    ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ] as const;

  ipv4Subnets.forEach(([network, prefix]) => addresses.addSubnet(network, prefix, "ipv4"));
  ipv6Subnets.forEach(([network, prefix]) => addresses.addSubnet(network, prefix, "ipv6"));
  return addresses;
}
