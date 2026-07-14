import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/constants";
import { getFriendLinkHostname, splitFriendRequirements } from "@/lib/friend-link-utils";

describe("friend link presentation helpers", () => {
  it("parses non-empty requirements without preserving surrounding whitespace", () => {
    expect(splitFriendRequirements(" HTTPS only \n\n Original writing\r\n"))
      .toEqual(["HTTPS only", "Original writing"]);
  });

  it("formats a stable hostname label", () => {
    expect(getFriendLinkHostname("https://www.example.com/notes"))
      .toBe("example.com");
  });

  it("enables the public friend page by default", () => {
    expect(DEFAULT_SITE_SETTINGS.friendsEnabled).toBe(true);
  });
});
