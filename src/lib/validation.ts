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
const FRIEND_LINK_SORT_MIN = -9999;
const FRIEND_LINK_SORT_MAX = 9999;
const HTTPS_PROTOCOL = "https:";
const MAILTO_PROTOCOL = "mailto:";
const HTTP_PROTOCOLS = new Set(["http:", HTTPS_PROTOCOL]);
const ANALYTICS_PATH_PATTERN = /^\/(?!\/)[^?#\\\u0000-\u001f]*$/;
const CONTACT_ROOT_PATH_PATTERN = /^\/(?!\/)[^\\\u0000-\u001f]*$/;
const DATABASE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const NON_PUBLIC_ADDRESSES = createNonPublicAddressList();
const FRIEND_URL_ERROR = "请输入公开可访问的 HTTPS 地址。";
const FRIEND_CONTACT_URL_ERROR = "联系地址必须是公开 HTTPS、mailto: 或站内根路径。";

export const publicFriendUrlSchema = z
  .string()
  .trim()
  .min(REQUIRED_TEXT_MIN)
  .max(PATH_MAX)
  .url()
  .refine(isPublicHttpsUrl, FRIEND_URL_ERROR)
  .transform(normalizePublicHttpsUrl);

const optionalPublicFriendUrlSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.union([z.literal(""), publicFriendUrlSchema]),
).transform((value) => value || undefined);

export const friendContactUrlSchema = z
  .string()
  .trim()
  .min(REQUIRED_TEXT_MIN)
  .max(PATH_MAX)
  .refine(isAllowedFriendContactUrl, FRIEND_CONTACT_URL_ERROR)
  .transform(normalizeFriendContactUrl);

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

export const postFormSchema = z.object({
  title: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  slug: z.string().trim().min(REQUIRED_TEXT_MIN).max(SLUG_MAX),
  excerpt: z.string().trim().max(EXCERPT_MAX).optional(),
  content: z.string().trim().min(REQUIRED_TEXT_MIN),
  categoryId: z.string().trim().optional().or(z.literal("")),
  tagNames: z.string().trim().optional(),
  seoTitle: z.string().trim().max(TITLE_MAX).optional(),
  seoDescription: z.string().trim().max(EXCERPT_MAX).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  slug: z.string().trim().min(REQUIRED_TEXT_MIN).max(SLUG_MAX),
  description: z.string().trim().max(EXCERPT_MAX).optional(),
});

export const friendLinkFormSchema = z.object({
  name: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  url: publicFriendUrlSchema,
  description: z.string().trim().min(REQUIRED_TEXT_MIN).max(EXCERPT_MAX),
  logoUrl: optionalPublicFriendUrlSchema,
  sortOrder: z.coerce.number().int().min(FRIEND_LINK_SORT_MIN).max(FRIEND_LINK_SORT_MAX),
  isVisible: z.boolean(),
});

export const friendSettingsSchema = z.object({
  friendsEnabled: z.boolean(),
  friendsIntro: z.string().trim().min(REQUIRED_TEXT_MIN).max(TEXTAREA_MAX),
  friendsRequirements: z.string().trim().max(TEXTAREA_MAX),
  friendsContactLabel: z.string().trim().min(REQUIRED_TEXT_MIN).max(TITLE_MAX),
  friendsContactUrl: friendContactUrlSchema,
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

export function isPublicHttpsUrl(value: string) {
  return parsePublicHttpsUrl(value) !== null;
}

export function normalizePublicHttpsUrl(value: string) {
  const url = new URL(value);
  url.hostname = url.hostname.replace(/\.$/, "");
  url.hash = "";
  return url.toString();
}

export function isAllowedFriendContactUrl(value: string) {
  if (CONTACT_ROOT_PATH_PATTERN.test(value)) {
    return true;
  }

  if (isPublicHttpsUrl(value)) {
    return true;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== MAILTO_PROTOCOL || url.hash) {
      return false;
    }

    const decodedAddress = decodeURIComponent(url.pathname);
    const decodedUrl = decodeURIComponent(`${url.pathname}${url.search}`);
    return !/[\r\n]/.test(decodedUrl) && z.email().safeParse(decodedAddress).success;
  } catch {
    return false;
  }
}

export function normalizeFriendContactUrl(value: string) {
  if (CONTACT_ROOT_PATH_PATTERN.test(value)) {
    return value;
  }

  return isPublicHttpsUrl(value) ? normalizePublicHttpsUrl(value) : new URL(value).toString();
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

function parsePublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = normalizeHostname(url.hostname);

    if (
      url.protocol !== HTTPS_PROTOCOL
      || url.username
      || url.password
      || !isPublicHostname(hostname)
    ) {
      return null;
    }

    const ipVersion = isIP(hostname);
    return ipVersion === 0 || !NON_PUBLIC_ADDRESSES.check(hostname, ipVersion === 4 ? "ipv4" : "ipv6")
      ? url
      : null;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
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
