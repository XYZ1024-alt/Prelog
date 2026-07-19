import { ImageResponse } from "next/og";

import { getPublishedPostBySlug } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const MAX_TITLE_CHARACTERS = 52;
const MAX_TAGS = 3;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const OG_BRAND = "PRELOG";
const UNCATEGORIZED_LABEL = "未分类";

type RouteContext = {
  readonly params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return new Response(null, { status: 404 });
  }

  const tags = post.tags.map(({ tag }) => tag.name).slice(0, MAX_TAGS);
  const response = new ImageResponse(
    (
      <div
        lang="zh-CN"
        style={{
          background: "#ffffff",
          color: "#18181b",
          display: "flex",
          height: "100%",
          padding: "64px 72px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(24,24,27,0.12)",
            bottom: 32,
            display: "flex",
            left: 32,
            position: "absolute",
            right: 32,
            top: 32,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ color: "#1d4ed8", display: "flex", fontSize: 19, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            {post.category?.name ?? UNCATEGORIZED_LABEL}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                display: "flex",
                fontSize: getTitleSize(post.title),
                fontWeight: 800,
                letterSpacing: -1,
                lineHeight: 1.08,
                maxWidth: 920,
                wordBreak: "break-all",
              }}
            >
              {truncateTitle(post.title)}
            </div>
            {tags.length > 0 ? (
              <div style={{ color: "#71717a", display: "flex", fontSize: 20, gap: 18 }}>
                {tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ color: "#71717a", display: "flex", fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
            {OG_BRAND}
          </div>
        </div>
      </div>
    ),
    { height: IMAGE_HEIGHT, width: IMAGE_WIDTH },
  );
  response.headers.set("Cache-Control", IMMUTABLE_CACHE);
  return response;
}

function truncateTitle(title: string) {
  const characters = Array.from(title);
  return characters.length > MAX_TITLE_CHARACTERS
    ? `${characters.slice(0, MAX_TITLE_CHARACTERS).join("")}...`
    : title;
}

function getTitleSize(title: string) {
  const length = Array.from(title).length;

  if (length > 38) {
    return 46;
  }

  if (length > 24) {
    return 56;
  }

  return 68;
}
