import { getPublishedPostsForFeed } from "@/lib/posts";
import { RSS_CONTENT_TYPE, RSS_PATH, createSiteUrl } from "@/lib/site-url";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const FEED_POST_LIMIT = 40;
const XML_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export async function GET() {
  const [posts, settings] = await Promise.all([
    getPublishedPostsForFeed(FEED_POST_LIMIT),
    getSiteSettings(),
  ]);
  const siteUrl = createSiteUrl("/").toString();
  const feedUrl = createSiteUrl(RSS_PATH).toString();
  const lastBuildDate = posts.reduce(
    (latest, post) => post.updatedAt > latest ? post.updatedAt : latest,
    settings.updatedAt,
  );
  const document = createRssDocument({ feedUrl, lastBuildDate, posts, settings, siteUrl });

  return new Response(document, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": `${RSS_CONTENT_TYPE}; charset=utf-8`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function createRssDocument(options: {
  readonly feedUrl: string;
  readonly lastBuildDate: Date;
  readonly posts: Awaited<ReturnType<typeof getPublishedPostsForFeed>>;
  readonly settings: Awaited<ReturnType<typeof getSiteSettings>>;
  readonly siteUrl: string;
}) {
  const items = options.posts.map(createRssItem).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(options.settings.siteName)}</title><link>${escapeXml(options.siteUrl)}</link><description>${escapeXml(options.settings.siteTagline)}</description><language>zh-CN</language><lastBuildDate>${options.lastBuildDate.toUTCString()}</lastBuildDate><atom:link href="${escapeXml(options.feedUrl)}" rel="self" type="${RSS_CONTENT_TYPE}"/>${items}</channel></rss>`;
}

function createRssItem(post: Awaited<ReturnType<typeof getPublishedPostsForFeed>>[number]) {
  const url = createSiteUrl(`/posts/${encodeURIComponent(post.slug)}`).toString();
  const categories = [post.category?.name, ...post.tags.map(({ tag }) => tag.name)]
    .filter((value): value is string => Boolean(value))
    .map((value) => `<category>${escapeXml(value)}</category>`)
    .join("");

  return `<item><title>${escapeXml(post.seoTitle ?? post.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><pubDate>${(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate><description>${escapeXml(post.seoDescription ?? post.excerpt)}</description>${categories}</item>`;
}

function escapeXml(value: string) {
  return value
    .replace(XML_CONTROL_CHARACTERS, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
