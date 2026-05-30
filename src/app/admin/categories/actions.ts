"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { toSlug } from "@/lib/text";
import { categoryFormSchema, idSchema } from "@/lib/validation";

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = parseCategoryForm(formData);

  await prisma.category.create({ data: categoryData(parsed) });
  revalidateCategories();
  redirect("/admin/categories");
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const parsed = parseCategoryForm(formData);

  await prisma.category.update({
    data: categoryData(parsed),
    where: { id },
  });
  revalidateCategories();
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;

  await prisma.category.delete({ where: { id } });
  revalidateCategories();
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

function revalidateCategories() {
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/posts");
  revalidatePath("/search");
}
