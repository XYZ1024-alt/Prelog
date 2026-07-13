"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Image as ImageIcon, RefreshCw, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";

import { regeneratePostGlyphCoverWithState } from "@/app/admin/posts/actions";
import { ArticleGlyph } from "@/components/article-glyph";
import { ButtonStateContent } from "@/components/button-state-content";
import { useDebouncedValue } from "@/components/use-debounced-value";
import {
  createArticleGlyphRecipe,
  createArticleGlyphSignals,
  getGlyphRecipeInitial,
  glyphRecipeSchema,
  type ArticleGlyphSignals,
  type GlyphRecipe,
  type GlyphRenderPreset,
} from "@/lib/glyph-recipe";
import { toSlug } from "@/lib/text";
import type { PostMutationState } from "@/lib/post-workflow";

type CoverMode = "GLYPH" | "MANUAL";

type PostCoverEditorProps = {
  readonly categoryName: string | null;
  readonly categorySlug: string | null;
  readonly content: string;
  readonly coverImage: string;
  readonly coverMode: CoverMode;
  readonly expectedUpdatedAt?: string;
  readonly initialGlyphGeneratedAt: string | null;
  readonly initialGlyphRecipe: unknown;
  readonly initialGlyphSourceHash: string | null;
  readonly manualCoverHosts: readonly string[];
  readonly postId?: string;
  readonly published: boolean;
  readonly savedCoverMode: CoverMode;
  readonly tagNames: string;
  readonly title: string;
  readonly onCoverImageChange: (value: string) => void;
  readonly onCoverModeChange: (value: CoverMode) => void;
};

const PREVIEW_POST_ID = "draft-preview";
const TAG_SEPARATOR = ",";
const COVER_SIGNAL_DEBOUNCE_MS = 220;
const INITIAL_MUTATION_STATE: PostMutationState = { status: "idle" };
const subscribeToClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export function PostCoverEditor(props: PostCoverEditorProps) {
  const debouncedContent = useDebouncedValue(props.content, COVER_SIGNAL_DEBOUNCE_MS);
  const signals = useMemo(
    () => createCandidateSignals(debouncedContent),
    [debouncedContent],
  );
  const candidate = useMemo(
    () =>
      createCandidateRecipe({
        categoryName: props.categoryName,
        categorySlug: props.categorySlug,
        postId: props.postId,
        signals,
        tagNames: props.tagNames,
        title: props.title,
      }),
    [props.categoryName, props.categorySlug, props.postId, props.tagNames, props.title, signals],
  );
  const lockedState = useMemo(
    () => parseLockedRecipe(props.initialGlyphRecipe, props.initialGlyphSourceHash),
    [props.initialGlyphRecipe, props.initialGlyphSourceHash],
  );

  return (
    <section className="post-cover-editor">
      <header className="post-cover-editor__header">
        <div>
          <span className="eyebrow">Cover System</span>
          <h2>文章封面</h2>
        </div>
        <CoverModeControl mode={props.coverMode} onChange={props.onCoverModeChange} />
      </header>
      <div className="post-cover-editor__panel" key={props.coverMode}>
        {props.coverMode === "MANUAL" ? (
          <ManualCoverField
            allowedHosts={props.manualCoverHosts}
            coverImage={props.coverImage}
            onChange={props.onCoverImageChange}
          />
        ) : (
          <GlyphCoverFields
            candidate={candidate}
            generatedAt={props.initialGlyphGeneratedAt}
            locked={lockedState.recipe}
            expectedUpdatedAt={props.expectedUpdatedAt}
            postId={props.postId}
            published={props.published}
            recipeError={lockedState.error}
            onRegenerated={() => props.onCoverModeChange(props.savedCoverMode)}
          />
        )}
      </div>
      {props.coverMode === "GLYPH" ? <input name="coverImage" type="hidden" value={props.coverImage} /> : null}
    </section>
  );
}

function CoverModeControl({ mode, onChange }: { readonly mode: CoverMode; readonly onChange: (value: CoverMode) => void }) {
  return (
    <fieldset aria-label="封面模式" className="post-cover-mode">
      <label className={mode === "GLYPH" ? "is-active" : undefined}>
        <input checked={mode === "GLYPH"} name="coverMode" onChange={() => onChange("GLYPH")} type="radio" value="GLYPH" />
        <ScanLine size={16} />
        自动字形
      </label>
      <label className={mode === "MANUAL" ? "is-active" : undefined}>
        <input checked={mode === "MANUAL"} name="coverMode" onChange={() => onChange("MANUAL")} type="radio" value="MANUAL" />
        <ImageIcon size={16} />
        人工图片
      </label>
    </fieldset>
  );
}

function ManualCoverField({
  allowedHosts,
  coverImage,
  onChange,
}: {
  readonly allowedHosts: readonly string[];
  readonly coverImage: string;
  readonly onChange: (value: string) => void;
}) {
  const previewError = getManualCoverPreviewError(coverImage, allowedHosts);

  return (
    <div className="post-cover-manual">
      <label>
        HTTPS 图片 URL
        <input
          name="coverImage"
          onChange={(event) => onChange(event.target.value)}
          pattern="https://.*"
          required
          type="url"
          value={coverImage}
        />
      </label>
      <div className="post-cover-manual__preview">
        {coverImage && !previewError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="人工封面预览" referrerPolicy="no-referrer" src={coverImage} />
        ) : <span>{previewError ?? "等待图片 URL"}</span>}
      </div>
    </div>
  );
}

function getManualCoverPreviewError(value: string, allowedHosts: readonly string[]) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

    if (url.protocol !== "https:" || url.username || url.password) {
      return "仅预览无凭据的 HTTPS 图片";
    }

    if (!allowedHosts.includes(hostname)) {
      return allowedHosts.length > 0 ? "图片主机不在允许列表" : "配置 MANUAL_COVER_HOSTS 后预览";
    }

    return null;
  } catch {
    return "请输入完整的 HTTPS 图片 URL";
  }
}

function GlyphCoverFields({
  candidate,
  expectedUpdatedAt,
  generatedAt,
  locked,
  postId,
  published,
  recipeError,
  onRegenerated,
}: {
  readonly candidate: GlyphRecipe | null;
  readonly expectedUpdatedAt?: string;
  readonly generatedAt: string | null;
  readonly locked: GlyphRecipe | null;
  readonly postId?: string;
  readonly published: boolean;
  readonly recipeError: string | null;
  readonly onRegenerated: () => void;
}) {
  const [preset, setPreset] = useState<Extract<GlyphRenderPreset, "feature" | "social">>("feature");
  const stale = Boolean(!recipeError && locked && candidate && locked.sourceHash !== candidate.sourceHash);
  const visibleRecipe = locked ?? candidate;

  return (
    <div className="post-cover-glyph">
      <div className="post-cover-glyph__status">
        <div>
          <strong>{getGlyphStatus({ generatedAt, locked, recipeError, stale })}</strong>
          {visibleRecipe ? <span>{formatLegend(visibleRecipe)}</span> : <span>填写标题和正文后生成候选封面。</span>}
        </div>
        <div className="post-cover-glyph__actions">
          <PreviewModeControl onChange={setPreset} preset={preset} />
          {postId && expectedUpdatedAt && published ? (
            <RegenerateGlyphButton
              expectedUpdatedAt={expectedUpdatedAt}
              onRegenerated={onRegenerated}
              postId={postId}
            />
          ) : null}
        </div>
      </div>
      {visibleRecipe ? (
        <div
          className={`post-cover-preview post-cover-preview--${preset} post-cover-preview__entry`}
          key={preset}
        >
          <CoverPreview label={locked ? "已锁定" : "当前候选"} preset={preset} recipe={visibleRecipe} />
          {stale && candidate ? <CoverPreview label="内容变更候选" preset={preset} recipe={candidate} /> : null}
        </div>
      ) : (
        <div className="post-cover-preview__empty">
          封面结构将在这里显示。
        </div>
      )}
    </div>
  );
}

function RegenerateGlyphButton({
  expectedUpdatedAt,
  onRegenerated,
  postId,
}: {
  readonly expectedUpdatedAt: string;
  readonly onRegenerated: () => void;
  readonly postId: string;
}) {
  const router = useRouter();
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const regenerate = () => {
    setError(null);
    const formData = new FormData();
    formData.set("id", postId);
    formData.set("expectedUpdatedAt", expectedUpdatedAt);
    startTransition(async () => {
      try {
        const result = await regeneratePostGlyphCoverWithState(INITIAL_MUTATION_STATE, formData);

        if (result.status === "error") {
          setError(result.message);
          return;
        }

        if (result.status === "success") {
          onRegenerated();
          router.push(result.href);
          return;
        }

        setError("重新生成未完成：服务器没有返回成功结果。");
      } catch (actionError) {
        console.error("Failed to regenerate the Glyph cover.", actionError);
        setError(getActionErrorMessage(actionError));
      }
    });
  };

  return (
    <div>
      <button
        aria-busy={pending}
        className="button post-cover-glyph__regenerate"
        data-client-ready={clientReady}
        disabled={pending || !clientReady}
        onClick={regenerate}
        title="使用数据库中已保存的文章内容重新生成并锁定封面"
        type="button"
      >
        <ButtonStateContent pending={pending} pendingChildren="正在生成...">
          <RefreshCw size={16} />
          重新生成
        </ButtonStateContent>
      </button>
      <p className="form-error" hidden={!error} role="alert">{error ?? ""}</p>
    </div>
  );
}

function getActionErrorMessage(error: unknown) {
  return error instanceof Error
    ? `重新生成失败：${error.message}`
    : "重新生成失败：服务器返回了无法识别的错误。";
}

function PreviewModeControl({
  onChange,
  preset,
}: {
  readonly onChange: (value: "feature" | "social") => void;
  readonly preset: "feature" | "social";
}) {
  return (
    <div aria-label="封面预览比例" className="post-cover-preview-mode" role="group">
      <button
        aria-pressed={preset === "feature"}
        onClick={() => onChange("feature")}
        type="button"
      >
        站内
      </button>
      <button
        aria-pressed={preset === "social"}
        onClick={() => onChange("social")}
        type="button"
      >
        分享图
      </button>
    </div>
  );
}

function CoverPreview({ label, preset, recipe }: { readonly label: string; readonly preset: GlyphRenderPreset; readonly recipe: GlyphRecipe }) {
  return (
    <figure>
      <ArticleGlyph preset={preset} recipe={recipe} />
      <figcaption>
        <span>{label}</span>
        <span>{recipe.sourceHash}</span>
      </figcaption>
    </figure>
  );
}

function createCandidateRecipe(input: {
  readonly categoryName: string | null;
  readonly categorySlug: string | null;
  readonly postId?: string;
  readonly signals: ArticleGlyphSignals | null;
  readonly tagNames: string;
  readonly title: string;
}) {
  if (!input.title.trim() || !input.signals) {
    return null;
  }

  const tags = createCandidateTags(input.tagNames);

  return createArticleGlyphRecipe({
    category: input.categorySlug,
    labels: {
      category: input.categoryName,
      tags: tags.map((tag) => tag.name),
    },
    postId: input.postId ?? PREVIEW_POST_ID,
    signals: input.signals,
    tags: tags.map((tag) => tag.slug),
    title: input.title,
  });
}

function createCandidateSignals(content: string): ArticleGlyphSignals | null {
  if (!content.trim()) {
    return null;
  }

  return createArticleGlyphSignals(content);
}

function createCandidateTags(tagNames: string) {
  const namesBySlug = new Map<string, string>();

  for (const rawName of tagNames.split(TAG_SEPARATOR)) {
    const name = rawName.trim();
    const slug = toSlug(name);

    if (name && slug && !namesBySlug.has(slug)) {
      namesBySlug.set(slug, name);
    }
  }

  return Array.from(namesBySlug, ([slug, name]) => ({ name, slug }));
}

function parseLockedRecipe(value: unknown, sourceHash: string | null) {
  if (value === null || value === undefined) {
    return { error: null, recipe: null };
  }

  const result = glyphRecipeSchema.safeParse(value);

  if (!result.success) {
    return { error: "已锁定封面无效 · 配方校验失败，请重新生成", recipe: null };
  }

  if (!sourceHash || result.data.sourceHash !== sourceHash) {
    return { error: "已锁定封面无效 · 版本标识不匹配，请重新生成", recipe: null };
  }

  return { error: null, recipe: result.data };
}

function getGlyphStatus(options: {
  readonly generatedAt: string | null;
  readonly locked: GlyphRecipe | null;
  readonly recipeError: string | null;
  readonly stale: boolean;
}) {
  if (options.recipeError) {
    return options.recipeError;
  }

  if (!options.locked) {
    return "尚未锁定 · 首次发布时保存";
  }

  if (options.stale) {
    return "已锁定 · 当前内容存在新的候选结构";
  }

  return options.generatedAt ? `已锁定 · ${formatDate(options.generatedAt)}` : "已锁定";
}

function formatLegend(recipe: GlyphRecipe) {
  const { codeBlocks, images, lists, quotes, sections } = recipe.legend;
  const initial = getGlyphRecipeInitial(recipe) ?? "旧版";
  return `首字母 ${initial} · 章节 ${sections} · 代码 ${codeBlocks} · 引用 ${quotes} · 列表 ${lists} · 图片 ${images}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
