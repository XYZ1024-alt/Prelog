type PostOgImageUrlInput = {
  readonly sourceHash: string;
  readonly slug: string;
};

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
export const RSS_CONTENT_TYPE = "application/rss+xml";
export const RSS_PATH = "/rss.xml";

export function getSiteUrl(): URL {
  const value = process.env.NEXTAUTH_URL;

  if (!value) {
    throw new Error("NEXTAUTH_URL is required to build absolute public URLs.");
  }

  const url = new URL(value);

  if (!HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error(`NEXTAUTH_URL must use HTTP or HTTPS, received ${url.protocol}`);
  }

  return url;
}

export function createPostOgImageUrl({ slug, sourceHash }: PostOgImageUrlInput): URL {
  const url = new URL(`/api/og/posts/${encodeURIComponent(slug)}`, getSiteUrl());
  url.searchParams.set("v", sourceHash);
  return url;
}

export function createSiteUrl(pathname: string): URL {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error(`Public pathname must be root-relative, received ${pathname}`);
  }

  return new URL(pathname, getSiteUrl());
}

export function createRssMetadataAlternates() {
  return {
    types: {
      [RSS_CONTENT_TYPE]: RSS_PATH,
    },
  };
}

export function createPageMetadataAlternates(pathname: string) {
  return {
    canonical: pathname,
    ...createRssMetadataAlternates(),
  };
}
