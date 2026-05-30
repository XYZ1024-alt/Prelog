import test from "node:test";
import assert from "node:assert/strict";

import { getDraftLoadState, getDraftSaveState, type DraftState } from "./draft-logic.ts";

test("旧草稿不会在文章已有更新后继续参与恢复", () => {
  const draft: DraftState = {
    savedAt: Date.parse("2026-05-30T09:00:00.000Z"),
    value: "old local draft",
  };

  const state = getDraftLoadState({
    baselineTimestamp: Date.parse("2026-05-30T10:00:00.000Z"),
    draft,
    initialValue: "server content",
  });

  assert.equal(state, "stale");
});

test("与服务器内容不同的草稿只标记为可恢复，不自动视为同步", () => {
  const draft: DraftState = {
    savedAt: Date.parse("2026-05-30T11:00:00.000Z"),
    value: "draft content",
  };

  const state = getDraftLoadState({
    baselineTimestamp: Date.parse("2026-05-30T10:00:00.000Z"),
    draft,
    initialValue: "server content",
  });

  assert.equal(state, "available");
});

test("恢复草稿后的首轮状态不会立即重新进入保存分支", () => {
  const state = getDraftSaveState({
    initialValue: "server content",
    restoredValue: "draft content",
    value: "draft content",
  });

  assert.equal(state, "restored");
});

test("真实修改后的内容仍然会进入待保存状态", () => {
  const state = getDraftSaveState({
    initialValue: "server content",
    restoredValue: null,
    value: "edited content",
  });

  assert.equal(state, "dirty");
});
