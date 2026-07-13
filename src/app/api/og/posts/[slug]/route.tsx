import { ImageResponse } from "next/og";

import { getGlyphRecipeInitial, renderGlyphRecipe, type GlyphRecipe } from "@/lib/glyph-recipe";
import { resolvePostCover } from "@/lib/post-cover";
import { getPublishedPostBySlug } from "@/lib/posts";
import { createPostOgImageUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const MAX_TITLE_CHARACTERS = 52;
const MAX_TAGS = 3;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const OG_BRAND = "PRELOG";
const UNCATEGORIZED_LABEL = "Uncategorized";

type RouteContext = {
  readonly params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return new Response(null, { status: 404 });
  }

  const cover = resolvePostCover(post);

  if (cover.mode === "MANUAL") {
    return Response.redirect(cover.imageUrl, 307);
  }

  const requestedVersion = new URL(request.url).searchParams.get("v");

  if (requestedVersion !== cover.sourceHash) {
    return Response.redirect(createPostOgImageUrl({ slug: post.slug, sourceHash: cover.sourceHash }), 307);
  }

  const response = new ImageResponse(
    (
      <div
        lang="zh-CN"
        style={{
          background: "#f7f7f1",
          color: "#101112",
          display: "flex",
          height: "100%",
          padding: "54px 58px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(16,17,18,0.16)",
            bottom: 28,
            display: "flex",
            left: 28,
            position: "absolute",
            right: 28,
            top: 28,
          }}
        />
        <div
          style={{
            borderLeft: "1px solid rgba(16,17,18,0.12)",
            bottom: 28,
            display: "flex",
            left: "64%",
            position: "absolute",
            top: 28,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "59%" }}>
          <div style={{ color: "#2355ff", display: "flex", fontSize: 18, fontWeight: 700, textTransform: "uppercase" }}>
            {cover.recipe.labels.category ?? UNCATEGORIZED_LABEL} / Journal entry
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div
              style={{
                display: "flex",
                fontSize: getTitleSize(cover.recipe.labels.title),
                fontWeight: 800,
                lineHeight: 1.05,
                maxWidth: 650,
                wordBreak: "break-all",
              }}
            >
              {truncateTitle(cover.recipe.labels.title)}
            </div>
            <div style={{ color: "#626870", display: "flex", fontSize: 19, gap: 18 }}>
              {cover.recipe.labels.tags.slice(0, MAX_TAGS).map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ color: "#626870", display: "flex", fontSize: 16, gap: 18, textTransform: "uppercase" }}>
            <span>{OG_BRAND}</span>
            <span>{formatLegend(cover.recipe)}</span>
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            color: "#2355ff",
            display: "flex",
            justifyContent: "center",
            overflow: "hidden",
            paddingLeft: 24,
            width: "41%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "monospace",
              fontSize: 10,
              lineHeight: 1,
              whiteSpace: "pre",
            }}
          >
            {renderGlyphRecipe(cover.recipe, "social")}
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
    return 42;
  }

  if (length > 24) {
    return 50;
  }

  return 60;
}

function formatLegend(recipe: GlyphRecipe) {
  const initial = getGlyphRecipeInitial(recipe) ?? "LEGACY";
  return `Initial ${initial} / Sections ${recipe.legend.sections} / Code ${recipe.legend.codeBlocks}`;
}
