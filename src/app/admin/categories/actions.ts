"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { toAdminPath } from "@/lib/admin-path";
import { createCategoryMutationCacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { toSlug } from "@/lib/text";
import { categoryFormSchema, idSchema } from "@/lib/validation";

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = parseCategoryForm(formData);

  const category = await prisma.category.create({ data: categoryData(parsed) });
  revalidateCategories([category.slug]);
  redirect(toAdminPath("/categories"));
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const parsed = parseCategoryForm(formData);

  const previous = await prisma.category.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  const category = await prisma.category.update({
    data: categoryData(parsed),
    where: { id },
  });
  revalidateCategories([previous.slug, category.slug]);
  redirect(toAdminPath("/categories"));
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;

  const category = await prisma.category.delete({ where: { id } });
  revalidateCategories([category.slug]);
}

function parseCategoryForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const rawSlug = String(formData.get("slug") ?? "");

  return categoryFormSchema.parse({
    description: formData.get("description"),
    name,
    slug: toSlug(rawSlug || name),
  });
}

function categoryData(parsed: ReturnType<typeof parseCategoryForm>) {
  return {
    description: parsed.description || null,
    name: parsed.name,
    slug: parsed.slug,
  };
}

function revalidateCategories(slugs: readonly string[]) {
  createCategoryMutationCacheTags(slugs).forEach((tag) => updateTag(tag));
  revalidatePath("/admin/categories");
  revalidatePath("/admin/posts");
}
