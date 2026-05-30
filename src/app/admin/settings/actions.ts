"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ADMIN_USER_ID, SITE_SETTINGS_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { adminProfileSchema, siteSettingsSchema } from "@/lib/validation";

const HASH_ROUNDS = 12;

export async function updateAdminProfile(formData: FormData) {
  await requireAdmin();
  const parsed = adminProfileSchema.parse({
    email: formData.get("email"),
    name: formData.get("name"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  const currentUser = await prisma.user.findUniqueOrThrow({
    where: { id: ADMIN_USER_ID },
  });
  const validPassword = await bcrypt.compare(parsed.currentPassword, currentUser.passwordHash);

  if (!validPassword) {
    redirect("/admin/settings?error=password");
  }

  if (parsed.email !== currentUser.email) {
    const duplicated = await prisma.user.findUnique({ where: { email: parsed.email } });

    if (duplicated && duplicated.id !== currentUser.id) {
      redirect("/admin/settings?error=email");
    }
  }

  const passwordHash = parsed.newPassword
    ? await bcrypt.hash(parsed.newPassword, HASH_ROUNDS)
    : currentUser.passwordHash;

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      email: parsed.email,
      name: parsed.name || null,
      passwordHash,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?updated=1");
}

export async function updateSiteSettings(formData: FormData) {
  await requireAdmin();
  const parsed = siteSettingsSchema.parse({
    siteName: formData.get("siteName"),
    siteTagline: formData.get("siteTagline"),
    heroTitle: formData.get("heroTitle"),
    heroExcerpt: formData.get("heroExcerpt"),
    aboutTitle: formData.get("aboutTitle"),
    aboutIntro: formData.get("aboutIntro"),
    aboutWriting: formData.get("aboutWriting"),
    aboutAudience: formData.get("aboutAudience"),
    aboutTopics: formData.get("aboutTopics"),
    footerPrimary: formData.get("footerPrimary"),
    footerSecondary: formData.get("footerSecondary"),
  });

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: parsed,
    create: { id: SITE_SETTINGS_ID, ...parsed },
  });

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?updated=site");
}
