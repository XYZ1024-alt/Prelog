"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { MarkdownEditor } from "@/app/admin/posts/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import type { Category, Post, PostTag, Tag } from "@/generated/prisma/client";
import { getDraftLoadState, getDraftSaveState, type DraftState } from "@/lib/draft-logic";
import type { PostMutationState } from "@/lib/post-workflow";

type PostWithTags = Post & {
  readonly tags: (PostTag & { readonly tag: Tag })[];
};

type EditorProps = {
  readonly action: (state: PostMutationState, formData: FormData) => Promise<PostMutationState>;
  readonly categories: readonly Category[];
  readonly post?: PostWithTags;
};

type PostEditorFormProps = EditorProps & {
  readonly draftKey: string;
  readonly initialFields: PostDraftFields;
};

type PostDraftFields = {
  readonly categoryId: string;
  readonly content: string;
  readonly excerpt: string;
  readonly seoDescription: string;
  readonly seoTitle: string;
  readonly slug: string;
  readonly status: "DRAFT" | "PUBLISHED";
  readonly tagNames: string;
  readonly title: string;
};

const DRAFT_STORAGE_VERSION = "v4";
const LEGACY_CONTENT_DRAFT_VERSION = "v2";
const DRAFT_DELAY_MS = 900;
const INITIAL_MUTATION_STATE: PostMutationState = { status: "idle" };

export function PostEditor({ action, categories, post }: EditorProps) {
  const draftKey = post ? `post:${post.id}` : "post:new";
  const initialFields = useMemo(() => createInitialFields(post), [post]);

  return (
    <PostEditorForm
      action={action}
      categories={categories}
      draftKey={draftKey}
      initialFields={initialFields}
      key={draftKey}
      post={post}
    />
  );
}

function PostEditorForm({ action, categories, draftKey, initialFields, post }: PostEditorFormProps) {
  const [fields, setFields] = useState(initialFields);
  const [mutationState, formAction] = useActionState(action, INITIAL_MUTATION_STATE);
  const draft = usePostFormDraft({ baselineTimestamp: post?.updatedAt.getTime(), draftKey, fields, initialFields, setFields });

  return (
    <form action={formAction} className="post-editor">
      {post ? (
        <>
          <input name="id" type="hidden" value={post.id} />
          <input name="expectedUpdatedAt" type="hidden" value={post.updatedAt.toISOString()} />
        </>
      ) : null}
      <div className="form-grid">
        <TextField label="标题" name="title" onChange={setField(setFields, "title")} required value={fields.title} />
        <TextField label="Slug" name="slug" onChange={setField(setFields, "slug")} placeholder="留空时根据标题生成拼音 slug" value={fields.slug} />
      </div>
      <label>
        摘要
        <textarea name="excerpt" onChange={(event) => setFields((current) => ({ ...current, excerpt: event.target.value }))} rows={3} value={fields.excerpt} />
      </label>
      <div className="form-grid">
        <label>
          分类
          <select name="categoryId" onChange={(event) => setFields((current) => ({ ...current, categoryId: event.target.value }))} value={fields.categoryId}>
            <option value="">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="标签" name="tagNames" onChange={setField(setFields, "tagNames")} placeholder="Next.js, Pretext" value={fields.tagNames} />
      </div>
      <MarkdownEditor draft={draft} excerpt={fields.excerpt} setValue={setField(setFields, "content")} title={fields.title} value={fields.content} />
      <div className="form-grid">
        <TextField label="SEO 标题" name="seoTitle" onChange={setField(setFields, "seoTitle")} value={fields.seoTitle} />
        <TextField label="SEO 描述" name="seoDescription" onChange={setField(setFields, "seoDescription")} value={fields.seoDescription} />
      </div>
      <label>
        状态
        <select name="status" onChange={(event) => setFields((current) => ({ ...current, status: parsePostStatus(event.target.value) }))} value={fields.status}>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">发布</option>
        </select>
      </label>
      <SubmitButton className="button button--primary" pendingChildren="保存中...">
        保存
      </SubmitButton>
      <p className="form-error" hidden={mutationState.status !== "error"} role="alert">
        {mutationState.status === "error" ? mutationState.message : ""}
      </p>
    </form>
  );
}

function TextField(props: {
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly type?: string;
  readonly value: string;
}) {
  return (
    <label>
      {props.label}
      <input name={props.name} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} required={props.required} type={props.type} value={props.value} />
    </label>
  );
}

function createInitialFields(post?: PostWithTags): PostDraftFields {
  return {
    categoryId: post?.categoryId ?? "",
    content: post?.content ?? "",
    excerpt: post?.excerpt ?? "",
    seoDescription: post?.seoDescription ?? "",
    seoTitle: post?.seoTitle ?? "",
    slug: post?.slug ?? "",
    status: post?.status ?? "DRAFT",
    tagNames: post?.tags.map(({ tag }) => tag.name).join(", ") ?? "",
    title: post?.title ?? "",
  };
}

function setField(setFields: Dispatch<SetStateAction<PostDraftFields>>, key: keyof PostDraftFields) {
  return (value: string) => setFields((current) => ({ ...current, [key]: key === "status" ? parsePostStatus(value) : value }));
}

function parsePostStatus(value: string) {
  return value === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
}

function usePostFormDraft(options: {
  readonly baselineTimestamp?: number;
  readonly draftKey: string;
  readonly fields: PostDraftFields;
  readonly initialFields: PostDraftFields;
  readonly setFields: Dispatch<SetStateAction<PostDraftFields>>;
}) {
  const { baselineTimestamp, draftKey, fields, initialFields, setFields } = options;
  const storageKey = `prelog:post-form-draft:${DRAFT_STORAGE_VERSION}:${draftKey}`;
  const legacyContentKey = `prelog:draft:${LEGACY_CONTENT_DRAFT_VERSION}:${draftKey}`;
  const [remoteDraft, setRemoteDraft] = useState<DraftState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("本地草稿准备中");
  const restoredValueRef = useRef<string | null>(null);
  const initialValue = useMemo(() => serializeFields(initialFields), [initialFields]);
  const value = useMemo(() => serializeFields(fields), [fields]);

  useResetDraftState({ draftKey, setLoaded, setRemoteDraft, setStatus, storageKey });
  useLoadPostDraft({ baselineTimestamp, initialFields, initialValue, legacyContentKey, loaded, setLoaded, setRemoteDraft, setStatus, storageKey });
  useSavePostDraft({ initialValue, loaded, restoredValueRef, setRemoteDraft, setStatus, storageKey, value });

  return {
    clear: () => clearPostDraft({ setRemoteDraft, setStatus, storageKey }),
    hasRemoteDraft: Boolean(remoteDraft && remoteDraft.value !== value),
    restore: () => restorePostDraft({ remoteDraft, restoredValueRef, setFields, setStatus }),
    status,
  };
}

function useResetDraftState(options: {
  readonly draftKey: string;
  readonly setLoaded: (loaded: boolean) => void;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
}) {
  const { draftKey, setLoaded, setRemoteDraft, setStatus, storageKey } = options;

  useEffect(() => {
    setLoaded(false);
    setRemoteDraft(null);
    setStatus("本地草稿准备中");
  }, [draftKey, setLoaded, setRemoteDraft, setStatus, storageKey]);
}

function useLoadPostDraft(options: {
  readonly baselineTimestamp?: number;
  readonly initialFields: PostDraftFields;
  readonly initialValue: string;
  readonly legacyContentKey: string;
  readonly loaded: boolean;
  readonly setLoaded: (loaded: boolean) => void;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
}) {
  const { baselineTimestamp, initialFields, initialValue, legacyContentKey, loaded, setLoaded, setRemoteDraft, setStatus, storageKey } =
    options;

  useEffect(() => {
    if (loaded) {
      return;
    }

    loadPostDraft({
      baselineTimestamp,
      initialFields,
      initialValue,
      legacyContentKey,
      setLoaded,
      setRemoteDraft,
      setStatus,
      storageKey,
    });
  }, [baselineTimestamp, initialFields, initialValue, legacyContentKey, loaded, setLoaded, setRemoteDraft, setStatus, storageKey]);
}

function useSavePostDraft(options: {
  readonly initialValue: string;
  readonly loaded: boolean;
  readonly restoredValueRef: MutableRefObject<string | null>;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
  readonly value: string;
}) {
  const { initialValue, loaded, restoredValueRef, setRemoteDraft, setStatus, storageKey, value } = options;

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const saveState = getDraftSaveState({ initialValue, restoredValue: restoredValueRef.current, value });

    if (saveState === "synced") {
      setStatus("当前内容与已保存版本一致");
      return;
    }

    if (saveState === "restored") {
      restoredValueRef.current = null;
      setStatus("已恢复本地草稿");
      return;
    }

    setStatus("正在保存本地草稿");
    const id = window.setTimeout(() => savePostDraft({ setRemoteDraft, setStatus, storageKey, value }), DRAFT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [initialValue, loaded, restoredValueRef, setRemoteDraft, setStatus, storageKey, value]);
}

function loadPostDraft(options: {
  readonly baselineTimestamp?: number;
  readonly initialFields: PostDraftFields;
  readonly initialValue: string;
  readonly legacyContentKey: string;
  readonly setLoaded: (loaded: boolean) => void;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
}) {
  try {
    const draft = readPostDraft({
      initialFields: options.initialFields,
      legacyContentKey: options.legacyContentKey,
      storageKey: options.storageKey,
    });
    const draftState = getDraftLoadState({ baselineTimestamp: options.baselineTimestamp, draft, initialValue: options.initialValue });

    applyLoadedDraftState({ ...options, draft, draftState });
  } catch (error) {
    options.setStatus(`本地草稿不可用：${getErrorMessage(error)}`);
  } finally {
    options.setLoaded(true);
  }
}

function applyLoadedDraftState(options: {
  readonly draft: DraftState | null;
  readonly draftState: ReturnType<typeof getDraftLoadState>;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
}) {
  if (options.draftState === "stale") {
    window.localStorage.removeItem(options.storageKey);
    options.setRemoteDraft(null);
    options.setStatus("已忽略过期的本地草稿");
    return;
  }

  if (options.draftState === "available" && options.draft) {
    options.setRemoteDraft(options.draft);
    options.setStatus(`发现本地草稿 ${formatTime(options.draft.savedAt)}`);
    return;
  }

  options.setRemoteDraft(null);
  options.setStatus("本地草稿已就绪");
}

function readPostDraft(options: {
  readonly initialFields: PostDraftFields;
  readonly legacyContentKey: string;
  readonly storageKey: string;
}) {
  const raw = window.localStorage.getItem(options.storageKey);

  if (raw) {
    return JSON.parse(raw) as DraftState;
  }

  return readLegacyContentDraft(options);
}

function readLegacyContentDraft(options: {
  readonly initialFields: PostDraftFields;
  readonly legacyContentKey: string;
}) {
  const raw = window.localStorage.getItem(options.legacyContentKey);
  const legacyDraft = raw ? (JSON.parse(raw) as DraftState) : null;

  if (!legacyDraft?.value) {
    return null;
  }

  return {
    savedAt: legacyDraft.savedAt,
    value: serializeFields({ ...options.initialFields, content: legacyDraft.value }),
  };
}

function savePostDraft({ setRemoteDraft, setStatus, storageKey, value }: {
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
  readonly value: string;
}) {
  try {
    const draft = { savedAt: Date.now(), value };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setRemoteDraft(draft);
    setStatus(`本地草稿已保存 ${formatTime(draft.savedAt)}`);
  } catch (error) {
    setStatus(`本地草稿保存失败：${getErrorMessage(error)}`);
  }
}

function clearPostDraft(options: {
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
}) {
  window.localStorage.removeItem(options.storageKey);
  options.setRemoteDraft(null);
  options.setStatus("本地草稿已清除");
}

function restorePostDraft(options: {
  readonly remoteDraft: DraftState | null;
  readonly restoredValueRef: MutableRefObject<string | null>;
  readonly setFields: Dispatch<SetStateAction<PostDraftFields>>;
  readonly setStatus: (status: string) => void;
}) {
  if (!options.remoteDraft) {
    return;
  }

  options.restoredValueRef.current = options.remoteDraft.value;
  options.setFields(parseFields(options.remoteDraft.value));
  options.setStatus(`已恢复本地草稿 ${formatTime(options.remoteDraft.savedAt)}`);
}

function serializeFields(fields: PostDraftFields) {
  return JSON.stringify(fields);
}

function parseFields(value: string): PostDraftFields {
  return JSON.parse(value) as PostDraftFields;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}
