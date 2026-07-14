"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { toAdminPath } from "@/lib/admin-path";
import {
  createFriendLinksMutationCacheTags,
  createSiteSettingsMutationCacheTags,
} from "@/lib/cache-tags";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "@/lib/constants";
import type {
  FriendLinkFormValues,
  FriendLinkMutationState,
  FriendLinkRowActionState,
  FriendSettingsFormValues,
  FriendSettingsMutationState,
} from "@/lib/friend-link-workflow";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { friendLinkFormSchema, friendSettingsSchema, idSchema } from "@/lib/validation";

const DUPLICATE_URL_MESSAGE = "该网站地址已经存在。";
const MISSING_LINK_MESSAGE = "友链不存在或已被删除。";

export async function createFriendLink(
  previousState: FriendLinkMutationState,
  formData: FormData,
): Promise<FriendLinkMutationState> {
  await requireAdmin();
  const values = getFriendLinkFormValues(formData);
  const parsed = friendLinkFormSchema.safeParse(values);

  if (!parsed.success) {
    return createFriendLinkValidationState(previousState, values, parsed.error);
  }

  try {
    await prisma.friendLink.create({ data: createFriendLinkData(parsed.data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return createFriendLinkErrorState(previousState, values, DUPLICATE_URL_MESSAGE, "url");
    }
    throw error;
  }

  revalidateFriends();
  redirect(toAdminPath("/friends?created=1"));
}

export async function updateFriendLink(
  previousState: FriendLinkMutationState,
  formData: FormData,
): Promise<FriendLinkMutationState> {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const values = getFriendLinkFormValues(formData);
  const parsed = friendLinkFormSchema.safeParse(values);

  if (!parsed.success) {
    return createFriendLinkValidationState(previousState, values, parsed.error);
  }

  try {
    await prisma.friendLink.update({
      data: createFriendLinkData(parsed.data),
      where: { id },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return createFriendLinkErrorState(previousState, values, DUPLICATE_URL_MESSAGE, "url");
    }
    if (isMissingRecordError(error)) {
      return createFriendLinkErrorState(previousState, values, MISSING_LINK_MESSAGE);
    }
    throw error;
  }

  revalidateFriends();
  redirect(toAdminPath("/friends?updated=1"));
}

export async function toggleFriendLinkVisibility(
  _previousState: FriendLinkRowActionState,
  formData: FormData,
): Promise<FriendLinkRowActionState> {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;

  try {
    const current = await prisma.friendLink.findUniqueOrThrow({
      where: { id },
      select: { isVisible: true },
    });
    await prisma.friendLink.update({
      data: { isVisible: !current.isVisible },
      where: { id },
    });
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { message: MISSING_LINK_MESSAGE, status: "error" };
    }
    throw error;
  }

  revalidateFriends();
  return { status: "idle" };
}

export async function deleteFriendLink(
  _previousState: FriendLinkRowActionState,
  formData: FormData,
): Promise<FriendLinkRowActionState> {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;

  try {
    await prisma.friendLink.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { message: MISSING_LINK_MESSAGE, status: "error" };
    }
    throw error;
  }

  revalidateFriends();
  return { status: "idle" };
}

export async function updateFriendSettings(
  previousState: FriendSettingsMutationState,
  formData: FormData,
): Promise<FriendSettingsMutationState> {
  await requireAdmin();
  const values = getFriendSettingsFormValues(formData);
  const parsed = friendSettingsSchema.safeParse(values);

  if (!parsed.success) {
    return {
      fieldErrors: createFieldErrors(parsed.error),
      message: parsed.error.issues[0]?.message ?? "友链设置未通过校验。",
      revision: previousState.revision + 1,
      status: "error",
      values,
    };
  }

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: parsed.data,
    create: {
      id: SITE_SETTINGS_ID,
      ...DEFAULT_SITE_SETTINGS,
      ...parsed.data,
    },
  });

  revalidateFriends(true);
  return {
    revision: previousState.revision + 1,
    status: "success",
    values: parsed.data,
  };
}

function getFriendLinkFormValues(formData: FormData): FriendLinkFormValues {
  return {
    description: String(formData.get("description") ?? ""),
    isVisible: formData.has("isVisible"),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    name: String(formData.get("name") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    url: String(formData.get("url") ?? ""),
  };
}

function getFriendSettingsFormValues(formData: FormData): FriendSettingsFormValues {
  return {
    friendsContactLabel: String(formData.get("friendsContactLabel") ?? ""),
    friendsContactUrl: String(formData.get("friendsContactUrl") ?? ""),
    friendsEnabled: formData.has("friendsEnabled"),
    friendsIntro: String(formData.get("friendsIntro") ?? ""),
    friendsRequirements: String(formData.get("friendsRequirements") ?? ""),
  };
}

function createFriendLinkData(parsed: z.output<typeof friendLinkFormSchema>) {
  return {
    description: parsed.description,
    isVisible: parsed.isVisible,
    logoUrl: parsed.logoUrl || null,
    name: parsed.name,
    sortOrder: parsed.sortOrder,
    url: parsed.url,
  };
}

function createFriendLinkValidationState(
  previousState: FriendLinkMutationState,
  values: FriendLinkFormValues,
  error: z.ZodError,
): FriendLinkMutationState {
  return {
    fieldErrors: createFieldErrors(error),
    message: error.issues[0]?.message ?? "友链内容未通过校验。",
    revision: previousState.revision + 1,
    status: "error",
    values,
  };
}

function createFriendLinkErrorState(
  previousState: FriendLinkMutationState,
  values: FriendLinkFormValues,
  message: string,
  field?: string,
): FriendLinkMutationState {
  return {
    fieldErrors: field ? { [field]: [message] } : {},
    message,
    revision: previousState.revision + 1,
    status: "error",
    values,
  };
}

function createFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0),
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isMissingRecordError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function revalidateFriends(settingsChanged = false) {
  const tags = new Set(createFriendLinksMutationCacheTags());

  if (settingsChanged) {
    createSiteSettingsMutationCacheTags().forEach((tag) => tags.add(tag));
  }

  tags.forEach((tag) => updateTag(tag));
  revalidatePath("/admin/friends");
  revalidatePath("/friends");
  revalidatePath("/sitemap.xml");

  if (settingsChanged) {
    revalidatePath("/", "layout");
  }
}
