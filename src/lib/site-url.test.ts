import { afterEach, describe, expect, test } from "vitest";

import {
  RSS_CONTENT_TYPE,
  RSS_PATH,
  createPageMetadataAlternates,
  createSiteUrl,
  getSiteUrl,
} from "@/lib/site-url";

const ORIGINAL_SITE_URL = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) {
    delete process.env.NEXTAUTH_URL;
    return;
  }
  process.env.NEXTAUTH_URL = ORIGINAL_SITE_URL;
});

describe("public site URLs", () => {
  test("builds absolute URLs and page metadata alternates", () => {
    process.env.NEXTAUTH_URL = "https://prelog.example";

    expect(createSiteUrl("/posts/hello").toString()).toBe("https://prelog.example/posts/hello");
    expect(createPageMetadataAlternates("/archive")).toEqual({
      canonical: "/archive",
      types: { [RSS_CONTENT_TYPE]: RSS_PATH },
    });
  });

  test("rejects missing, unsafe, and unsupported site URLs", () => {
    delete process.env.NEXTAUTH_URL;
    expect(() => getSiteUrl()).toThrow("NEXTAUTH_URL is required");

    process.env.NEXTAUTH_URL = "ftp://prelog.example";
    expect(() => getSiteUrl()).toThrow("must use HTTP or HTTPS");

    process.env.NEXTAUTH_URL = "https://prelog.example";
    expect(() => createSiteUrl("//other.example/path")).toThrow("must be root-relative");
  });
});
