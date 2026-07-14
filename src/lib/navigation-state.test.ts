import { describe, expect, it } from "vitest";

import {
  isAdminNavigationItemActive,
  isAdminRoute,
  isNavigationItemActive,
} from "@/lib/navigation-state";

describe("isNavigationItemActive", () => {
  it("only selects the home item on the exact root path", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/posts/example", "/")).toBe(false);
  });

  it("selects section roots and their descendants without matching siblings", () => {
    expect(isNavigationItemActive("/categories", "/categories")).toBe(true);
    expect(isNavigationItemActive("/categories/engineering", "/categories")).toBe(true);
    expect(isNavigationItemActive("/categories-old", "/categories")).toBe(false);
    expect(isNavigationItemActive("/friends", "/friends")).toBe(true);
    expect(isNavigationItemActive("/friends-old", "/friends")).toBe(false);
  });
});

describe("isAdminRoute", () => {
  it("recognizes both a public alias and the internal admin path", () => {
    expect(isAdminRoute("/manage/posts", "/manage")).toBe(true);
    expect(isAdminRoute("/admin/posts", "/manage")).toBe(true);
    expect(isAdminRoute("/management", "/manage")).toBe(false);
  });
});

describe("isAdminNavigationItemActive", () => {
  const publicAdminPath = "/manage";

  it("selects the overview only on either admin root", () => {
    expect(isAdminNavigationItemActive("/manage", "/manage", publicAdminPath)).toBe(true);
    expect(isAdminNavigationItemActive("/admin", "/manage", publicAdminPath)).toBe(true);
    expect(isAdminNavigationItemActive("/manage/posts", "/manage", publicAdminPath)).toBe(false);
    expect(isAdminNavigationItemActive("/admin/posts", "/manage", publicAdminPath)).toBe(false);
  });

  it("selects child entries for public and rewritten internal paths", () => {
    const postsHref = "/manage/posts";

    expect(isAdminNavigationItemActive("/manage/posts/new", postsHref, publicAdminPath)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/posts/example/edit", postsHref, publicAdminPath)).toBe(true);
    expect(isAdminNavigationItemActive("/manage/comments", postsHref, publicAdminPath)).toBe(false);
  });
});
