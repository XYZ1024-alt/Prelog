import type { MetadataRoute } from "next";

import { getPublishedPostSitemapEntries } from "@/lib/posts";
import { createSiteUrl } from "@/lib/site-url";

// Metadata routes do not inherit the runtime boundary from the root layout.
export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  { changeFrequency: "weekly", path: "/", priority: 1 },
  { changeFrequency: "monthly", path: "/about", priority: 0.6 },
  { changeFrequency: "weekly", path: "/archive", priority: 0.8 },
  { changeFrequency: "weekly", path: "/categories", priority: 0.6 },
  { changeFrequency: "weekly", path: "/tags", priority: 0.6 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPostSitemapEntries();
  const latestPostUpdate = posts.reduce<Date | undefined>(
    (latest, post) => !latest || post.updatedAt > latest ? post.updatedAt : latest,
    undefined,
  );
  const categoryUpdates = new Map<string, Date>();
  const tagUpdates = new Map<string, Date>();

  posts.forEach((post) => {
    if (post.category) {
      setLatestUpdate(categoryUpdates, post.category.slug, post.updatedAt);
    }
    post.tags.forEach(({ tag }) => setLatestUpdate(tagUpdates, tag.slug, post.updatedAt));
  });

  return [
    ...STATIC_ROUTES.map((route) => ({
      changeFrequency: route.changeFrequency,
      ...(latestPostUpdate ? { lastModified: latestPostUpdate } : {}),
      priority: route.priority,
      url: createSiteUrl(route.path).toString(),
    })),
    ...posts.map((post) => ({
      changeFrequency: "monthly" as const,
      lastModified: post.updatedAt,
      priority: 0.8,
      url: createSiteUrl(`/posts/${encodeURIComponent(post.slug)}`).toString(),
    })),
    ...createTaxonomyEntries("categories", categoryUpdates),
    ...createTaxonomyEntries("tags", tagUpdates),
  ];
}

function createTaxonomyEntries(type: "categories" | "tags", updates: ReadonlyMap<string, Date>) {
  return Array.from(updates, ([slug, lastModified]) => ({
    changeFrequency: "weekly" as const,
    lastModified,
    priority: 0.5,
    url: createSiteUrl(`/${type}/${encodeURIComponent(slug)}`).toString(),
  }));
}

function setLatestUpdate(updates: Map<string, Date>, slug: string, date: Date) {
  const current = updates.get(slug);
  if (!current || current < date) {
    updates.set(slug, date);
  }
}
