import { z } from "zod";

const REQUIRED_TEXT_MIN = 1;
const TITLE_MAX = 120;
const SLUG_MAX = 140;
const EXCERPT_MAX = 300;
const COMMENT_MAX = 1200;
const PASSWORD_MIN = 8;
const PATH_MAX = 2048;
const REFERRER_MAX = 2048;
const TEXTAREA_MAX = 2000;

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
  coverImage: z.string().trim().url().optional().or(z.literal("")),
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

export const commentSchema = z.object({
  postId: z.string().min(REQUIRED_TEXT_MIN),
  slug: z.string().min(REQUIRED_TEXT_MIN),
  parentId: z.string().trim().optional().or(z.literal("")),
  author: z.string().trim().min(REQUIRED_TEXT_MIN).max(80),
  email: z.email(),
  body: z.string().trim().min(REQUIRED_TEXT_MIN).max(COMMENT_MAX),
  website: z.string().max(0).optional(),
});

export const idSchema = z.object({
  id: z.string().min(REQUIRED_TEXT_MIN),
});

export const analyticsSchema = z.object({
  path: z.string().trim().min(REQUIRED_TEXT_MIN).max(PATH_MAX).startsWith("/"),
  referrer: z.string().trim().max(REFERRER_MAX).optional().or(z.literal("")),
});

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
