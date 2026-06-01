import { describe, expect, test } from "vitest";

import { getDraftLoadState, getDraftSaveState, type DraftState } from "./draft-logic.ts";

describe("draft logic", () => {
  test("marks older local drafts as stale after the server post changed", () => {
    const draft: DraftState = {
      savedAt: Date.parse("2026-05-30T09:00:00.000Z"),
      value: "old local draft",
    };

    const state = getDraftLoadState({
      baselineTimestamp: Date.parse("2026-05-30T10:00:00.000Z"),
      draft,
      initialValue: "server content",
    });

    expect(state).toBe("stale");
  });

  test("marks different fresh local drafts as restorable", () => {
    const draft: DraftState = {
      savedAt: Date.parse("2026-05-30T11:00:00.000Z"),
      value: "draft content",
    };

    const state = getDraftLoadState({
      baselineTimestamp: Date.parse("2026-05-30T10:00:00.000Z"),
      draft,
      initialValue: "server content",
    });

    expect(state).toBe("available");
  });

  test("does not immediately resave a just-restored draft", () => {
    const state = getDraftSaveState({
      initialValue: "server content",
      restoredValue: "draft content",
      value: "draft content",
    });

    expect(state).toBe("restored");
  });

  test("marks actual edits as dirty", () => {
    const state = getDraftSaveState({
      initialValue: "server content",
      restoredValue: null,
      value: "edited content",
    });

    expect(state).toBe("dirty");
  });
});
