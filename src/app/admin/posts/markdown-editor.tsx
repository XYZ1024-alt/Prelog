"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { Bold, CheckSquare, Code2, Eye, Heading2, Image, Italic, Link, List, Pilcrow, Quote, Table2 } from "lucide-react";
import { layout, prepare } from "@chenglou/pretext";

import { DynamicArticleLayout } from "@/components/dynamic-article-layout";
import { useClientMounted } from "@/components/use-client-mounted";
import { getDraftLoadState, getDraftSaveState, type DraftState } from "@/lib/draft-logic";
import { analyzeEditorial, type EditorialReport } from "@/lib/editorial-engine";
import { estimateReadingMinutes, plainTextFromMarkdown } from "@/lib/text";

type EditorMode = "write" | "preview";

const BODY_FONT = '16px "SFMono-Regular", Consolas, monospace';
const BODY_LINE_HEIGHT = 26;
const MIN_MEASURE_WIDTH = 280;
const TEXTAREA_HORIZONTAL_PADDING = 26;
const EDITOR_MIN_HEIGHT = 560;
const EDITOR_MAX_HEIGHT = 900;
const EDITOR_HEIGHT_BUFFER_LINES = 4;
const DRAFT_DELAY_MS = 900;
const DRAFT_STORAGE_VERSION = "v2";
const PARAGRAPH_WARN_LINES = 7;
const PARAGRAPH_WARN_CHARS_PER_LINE = 38;

const toolbarItems = [
  { label: "二级标题", icon: Heading2, before: "## ", after: "" },
  { label: "三级标题", icon: Heading2, before: "### ", after: "" },
  { label: "粗体", icon: Bold, before: "**", after: "**" },
  { label: "斜体", icon: Italic, before: "*", after: "*" },
  { label: "引用", icon: Quote, before: "> ", after: "" },
  { label: "列表", icon: List, before: "- ", after: "" },
  { label: "任务", icon: CheckSquare, before: "- [ ] ", after: "" },
  { label: "TypeScript", icon: Code2, before: "```ts\n", after: "\n```" },
  { label: "Prisma", icon: Code2, before: "```prisma\n", after: "\n```" },
  { label: "表格", icon: Table2, before: "| 字段 | 说明 |\n| --- | --- |\n|  |  |\n", after: "" },
  { label: "链接", icon: Link, before: "[", after: "](https://)" },
  { label: "图片", icon: Image, before: "![描述](", after: ")" },
] as const;

type MarkdownEditorProps = {
  readonly baselineTimestamp?: number;
  readonly defaultValue?: string;
  readonly draftKey: string;
  readonly excerpt: string;
  readonly title: string;
};

export function MarkdownEditor({ baselineTimestamp, defaultValue, draftKey, excerpt, title }: MarkdownEditorProps) {
  const initialValue = defaultValue ?? "";
  const [mode, setMode] = useState<EditorMode>("write");
  const [value, setValue] = useState(initialValue);
  const [editorWidth, setEditorWidth] = useState(MIN_MEASURE_WIDTH);
  const [cursor, setCursor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mounted = useClientMounted();
  const stats = useMemo(() => createStats({ cursor, markdown: value, mounted, width: editorWidth }), [cursor, editorWidth, mounted, value]);
  const report = useMemo(() => getReport({ editorWidth, excerpt, mounted, title, value }), [editorWidth, excerpt, mounted, title, value]);
  const draft = useLocalDraft({ baselineTimestamp, draftKey, initialValue, mounted, setValue, value });

  useEffect(() => {
    setValue(initialValue);
    setCursor(0);
  }, [draftKey, initialValue]);

  useTextareaWidth(textareaRef, setEditorWidth);

  return (
    <section className="markdown-editor">
      <EditorHeader draft={draft} mode={mode} report={report} setMode={setMode} stats={stats} />
      <Toolbar onInsert={(before, after) => insertAroundSelection({ after, before, setCursor, setValue, textarea: textareaRef.current })} />
      <EditorWorkspace mode={mode} previewRef={previewRef} setCursor={setCursor} setValue={setValue} stats={stats} textareaRef={textareaRef} value={value} />
      <EditorialPanel report={report} stats={stats} />
    </section>
  );
}

type DraftControls = {
  readonly clear: () => void;
  readonly hasRemoteDraft: boolean;
  readonly restore: () => void;
  readonly status: string;
};

type EditorHeaderProps = {
  readonly draft: DraftControls;
  readonly mode: EditorMode;
  readonly report: EditorialReport | null;
  readonly setMode: (mode: EditorMode) => void;
  readonly stats: EditorStats;
};

function EditorHeader({ draft, mode, report, setMode, stats }: EditorHeaderProps) {
  return (
    <div className="markdown-editor__head">
      <div className="markdown-editor__tabs">
        <button className={mode === "write" ? "is-active" : ""} onClick={() => setMode("write")} type="button">
          <Pilcrow size={15} />
          编辑
        </button>
        <button className={mode === "preview" ? "is-active" : ""} onClick={() => setMode("preview")} type="button">
          <Eye size={15} />
          预览
        </button>
      </div>
      <EditorStatus draft={draft} report={report} stats={stats} />
    </div>
  );
}

function EditorStatus({ draft, report, stats }: { readonly draft: DraftControls; readonly report: EditorialReport | null; readonly stats: EditorStats }) {
  return (
    <div className="markdown-editor__status">
      <span>{report ? `${report.score} 分` : "分析中"}</span>
      <span>{stats.chars} 字符</span>
      <span>{stats.lines} 行</span>
      <span>第 {stats.cursorLine} 行</span>
      <span>约 {stats.minutes} 分钟</span>
      <span>{draft.status}</span>
      {draft.hasRemoteDraft ? (
        <button onClick={draft.restore} type="button">
          恢复草稿
        </button>
      ) : null}
      {draft.hasRemoteDraft ? (
        <button onClick={draft.clear} type="button">
          清除
        </button>
      ) : null}
    </div>
  );
}

function Toolbar({ onInsert }: { readonly onInsert: (before: string, after: string) => void }) {
  return (
    <div className="markdown-editor__toolbar">
      {toolbarItems.map((item) => {
        const Icon = item.icon;

        return (
          <button aria-label={item.label} key={item.label} onClick={() => onInsert(item.before, item.after)} title={item.label} type="button">
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

type EditorWorkspaceProps = {
  readonly mode: EditorMode;
  readonly previewRef: RefObject<HTMLDivElement | null>;
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly stats: EditorStats;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
};

function EditorWorkspace(props: EditorWorkspaceProps) {
  const { mode, previewRef, setCursor, setValue, stats, textareaRef, value } = props;

  return (
    <>
      <input name="content" type="hidden" value={value} />
      <div className={mode === "preview" ? "markdown-editor__workspace is-preview" : "markdown-editor__workspace"}>
        {mode === "write" ? <EditorTextarea setCursor={setCursor} setValue={setValue} stats={stats} textareaRef={textareaRef} value={value} /> : null}
        <div className="markdown-editor__preview" ref={previewRef}>
          <DynamicArticleLayout content={value || "## 预览\n\n开始输入 Markdown 后，这里会实时渲染。"} />
        </div>
      </div>
    </>
  );
}

type EditorTextareaProps = {
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly stats: EditorStats;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
};

function EditorTextarea({ setCursor, setValue, stats, textareaRef, value }: EditorTextareaProps) {
  return (
    <textarea
      className="code-textarea markdown-editor__textarea"
      onChange={(event) => setValue(event.target.value)}
      onScroll={(event) => syncPreviewScroll(event.currentTarget)}
      onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
      ref={textareaRef}
      required
      rows={22}
      style={{ minHeight: getEditorHeight(stats.height) }}
      value={value}
    />
  );
}

function EditorialPanel({ report, stats }: { readonly report: EditorialReport | null; readonly stats: EditorStats }) {
  if (!report) {
    return <aside className="editorial-panel">正在初始化编辑分析。</aside>;
  }

  return (
    <aside className="editorial-panel">
      <div>
        <strong>编辑建议</strong>
        <span>
          标题 {report.titleLines} 行 · 摘要 {report.excerptLines} 行 · 正文 {report.contentLines} 行 · 行宽 {report.bodyWidth}px · 平均 {report.averageCharsPerLine} 字/行
        </span>
      </div>
      <CurrentParagraphInsight insight={stats.paragraph} />
      <ul>
        {report.findings.map((finding) => (
          <li className={`is-${finding.level}`} key={finding.message}>
            {finding.message}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function CurrentParagraphInsight({ insight }: { readonly insight: ParagraphInsight }) {
  return (
    <div className="editorial-panel__focus">
      <strong>当前段落</strong>
      <span>
        {insight.lines} 行 · {insight.chars} 字 · 平均 {insight.averageCharsPerLine} 字/行 · {insight.message}
      </span>
    </div>
  );
}

type EditorStats = {
  readonly chars: number;
  readonly cursorLine: number;
  readonly height: number;
  readonly lines: number;
  readonly minutes: number;
  readonly paragraph: ParagraphInsight;
  readonly words: number;
};

type ParagraphInsight = {
  readonly averageCharsPerLine: number;
  readonly chars: number;
  readonly lines: number;
  readonly message: string;
};

function getReport(options: { readonly editorWidth: number; readonly excerpt: string; readonly mounted: boolean; readonly title: string; readonly value: string }) {
  if (!options.mounted) {
    return null;
  }

  return analyzeEditorial({ title: options.title, excerpt: options.excerpt, markdown: options.value, width: options.editorWidth });
}

function createStats({ cursor, markdown, mounted, width }: StatsOptions): EditorStats {
  const plainText = plainTextFromMarkdown(markdown);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const layoutStats = mounted ? measureMarkdown({ markdown, width }) : { lines: 0, height: 0 };
  const paragraph = mounted ? measureCurrentParagraph({ cursor, markdown, width }) : createEmptyParagraphInsight();

  return { chars: plainText.length, cursorLine: getCursorLine(markdown, cursor), minutes: estimateReadingMinutes(markdown), paragraph, words, ...layoutStats };
}

type StatsOptions = {
  readonly cursor: number;
  readonly markdown: string;
  readonly mounted: boolean;
  readonly width: number;
};

function useLocalDraft(options: DraftOptions): DraftControls {
  const legacyStorageKey = `prelog:draft:${options.draftKey}`;
  const storageKey = `prelog:draft:${DRAFT_STORAGE_VERSION}:${options.draftKey}`;
  const [remoteDraft, setRemoteDraft] = useState<DraftState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("本地草稿准备中");
  const restoredValueRef = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.removeItem(legacyStorageKey);
    setLoaded(false);
    setRemoteDraft(null);
    setStatus("本地草稿准备中");
    restoredValueRef.current = null;
  }, [legacyStorageKey, options.draftKey, options.initialValue]);

  useLoadDraft({ ...options, loaded, restoredValueRef, setLoaded, setRemoteDraft, setStatus, storageKey });
  useSaveDraft({ initialValue: options.initialValue, loaded, restoredValueRef, setRemoteDraft, setStatus, storageKey, value: options.value });

  return {
    clear: () => clearDraft({ setRemoteDraft, setStatus, storageKey }),
    hasRemoteDraft: Boolean(remoteDraft && remoteDraft.value !== options.value),
    restore: () => restoreDraft({ remoteDraft, restoredValueRef, setStatus, setValue: options.setValue }),
    status,
  };
}

type DraftOptions = {
  readonly baselineTimestamp?: number;
  readonly draftKey: string;
  readonly initialValue: string;
  readonly mounted: boolean;
  readonly setValue: (value: string) => void;
  readonly value: string;
};

function useLoadDraft(options: LoadDraftOptions) {
  useEffect(() => {
    if (!options.mounted || options.loaded) {
      return;
    }

    loadDraft(options);
  }, [
    options.baselineTimestamp,
    options.initialValue,
    options.loaded,
    options.mounted,
    options.restoredValueRef,
    options.setLoaded,
    options.setRemoteDraft,
    options.setStatus,
    options.storageKey,
  ]);
}

function useSaveDraft(options: SaveDraftOptions) {
  useEffect(() => {
    if (!options.loaded) {
      return;
    }

    const saveState = getDraftSaveState({
      initialValue: options.initialValue,
      restoredValue: options.restoredValueRef.current,
      value: options.value,
    });

    if (saveState === "synced") {
      options.setStatus("当前内容与已保存版本一致");
      return;
    }

    if (saveState === "restored") {
      options.restoredValueRef.current = null;
      options.setStatus("已恢复本地草稿");
      return;
    }

    options.setStatus("正在保存本地草稿");
    const id = window.setTimeout(() => saveDraft(options), DRAFT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [
    options.initialValue,
    options.loaded,
    options.restoredValueRef,
    options.setRemoteDraft,
    options.setStatus,
    options.storageKey,
    options.value,
  ]);
}

type LoadDraftOptions = DraftOptions & {
  readonly loaded: boolean;
  readonly restoredValueRef: MutableRefObject<string | null>;
  readonly setLoaded: (loaded: boolean) => void;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
};

type SaveDraftOptions = {
  readonly initialValue: string;
  readonly loaded: boolean;
  readonly restoredValueRef: MutableRefObject<string | null>;
  readonly setRemoteDraft: (draft: DraftState | null) => void;
  readonly setStatus: (status: string) => void;
  readonly storageKey: string;
  readonly value: string;
};

function loadDraft(options: LoadDraftOptions) {
  try {
    const raw = window.localStorage.getItem(options.storageKey);
    const draft = raw ? (JSON.parse(raw) as DraftState) : null;
    const draftState = getDraftLoadState({
      baselineTimestamp: options.baselineTimestamp,
      draft,
      initialValue: options.initialValue,
    });

    if (draftState === "empty") {
      options.setRemoteDraft(null);
      options.setStatus("本地草稿已就绪");
      return;
    }

    if (draftState === "stale") {
      window.localStorage.removeItem(options.storageKey);
      options.setRemoteDraft(null);
      options.setStatus("已忽略过期的本地草稿");
      return;
    }

    if (draftState === "available" && draft) {
      options.setRemoteDraft(draft);
      options.setStatus(`发现本地草稿 ${formatTime(draft.savedAt)}`);
      return;
    }

    options.setRemoteDraft(null);
    options.setStatus("本地草稿已就绪");
  } catch (error) {
    options.setStatus(`本地草稿不可用：${getErrorMessage(error)}`);
  } finally {
    options.setLoaded(true);
  }
}

function saveDraft({ setRemoteDraft, setStatus, storageKey, value }: SaveDraftOptions) {
  try {
    const draft = { savedAt: Date.now(), value };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setRemoteDraft(draft);
    setStatus(`本地草稿已保存 ${formatTime(draft.savedAt)}`);
  } catch (error) {
    setStatus(`本地草稿保存失败：${getErrorMessage(error)}`);
  }
}

function clearDraft({ setRemoteDraft, setStatus, storageKey }: { readonly setRemoteDraft: (draft: null) => void; readonly setStatus: (status: string) => void; readonly storageKey: string }) {
  window.localStorage.removeItem(storageKey);
  setRemoteDraft(null);
  setStatus("本地草稿已清除");
}

function restoreDraft(options: {
  readonly remoteDraft: DraftState | null;
  readonly restoredValueRef: MutableRefObject<string | null>;
  readonly setStatus: (status: string) => void;
  readonly setValue: (value: string) => void;
}) {
  const { remoteDraft, restoredValueRef, setStatus, setValue } = options;

  if (!remoteDraft) {
    return;
  }

  restoredValueRef.current = remoteDraft.value;
  setValue(remoteDraft.value);
  setStatus(`已恢复本地草稿 ${formatTime(remoteDraft.savedAt)}`);
}

type InsertOptions = {
  readonly after: string;
  readonly before: string;
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly textarea: HTMLTextAreaElement | null;
};

function insertAroundSelection({ after, before, setCursor, setValue, textarea }: InsertOptions) {
  if (!textarea) {
    return;
  }

  const { selectionEnd, selectionStart, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
  const nextCursor = selectionStart + before.length + selected.length;
  setValue(nextValue);
  setCursor(nextCursor);
  requestAnimationFrame(() => restoreSelection(textarea, nextCursor));
}

function restoreSelection(textarea: HTMLTextAreaElement, cursor: number) {
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}

function measureMarkdown({ markdown, width }: { readonly markdown: string; readonly width: number }) {
  const measuredWidth = Math.max(MIN_MEASURE_WIDTH, width - TEXTAREA_HORIZONTAL_PADDING);
  const prepared = prepare(markdown, BODY_FONT, { whiteSpace: "pre-wrap", letterSpacing: 0 });
  const result = layout(prepared, measuredWidth, BODY_LINE_HEIGHT);
  return { lines: result.lineCount, height: result.height };
}

function measureCurrentParagraph({ cursor, markdown, width }: { readonly cursor: number; readonly markdown: string; readonly width: number }) {
  const text = plainTextFromMarkdown(getCurrentParagraph(markdown, cursor));

  if (!text) {
    return createEmptyParagraphInsight();
  }

  const measuredWidth = Math.max(MIN_MEASURE_WIDTH, width - TEXTAREA_HORIZONTAL_PADDING);
  const prepared = prepare(text, BODY_FONT, { whiteSpace: "normal", letterSpacing: 0 });
  const result = layout(prepared, measuredWidth, BODY_LINE_HEIGHT);
  const averageCharsPerLine = Math.round(text.length / Math.max(1, result.lineCount));

  return {
    averageCharsPerLine,
    chars: text.length,
    lines: result.lineCount,
    message: getParagraphMessage(result.lineCount, averageCharsPerLine),
  };
}

function getCurrentParagraph(markdown: string, cursor: number) {
  const start = markdown.lastIndexOf("\n\n", Math.max(0, cursor - 1));
  const end = markdown.indexOf("\n\n", cursor);
  const paragraphStart = start === -1 ? 0 : start + 2;
  const paragraphEnd = end === -1 ? markdown.length : end;
  return markdown.slice(paragraphStart, paragraphEnd).trim();
}

function getParagraphMessage(lines: number, charsPerLine: number) {
  if (lines >= PARAGRAPH_WARN_LINES) {
    return "段落偏长，建议拆成两个阅读单元";
  }

  if (charsPerLine >= PARAGRAPH_WARN_CHARS_PER_LINE) {
    return "单行信息偏密，可以补一个停顿或小标题";
  }

  return "断行节奏稳定";
}

function createEmptyParagraphInsight(): ParagraphInsight {
  return { averageCharsPerLine: 0, chars: 0, lines: 0, message: "等待输入" };
}

function getCursorLine(markdown: string, cursor: number) {
  return markdown.slice(0, cursor).split("\n").length;
}

function useTextareaWidth(ref: RefObject<HTMLTextAreaElement | null>, setWidth: (width: number) => void) {
  useEffect(() => {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    setWidth(textarea.clientWidth);
    const observer = new ResizeObserver(() => setWidth(textarea.clientWidth));
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [ref, setWidth]);
}

function syncPreviewScroll(textarea: HTMLTextAreaElement) {
  const preview = textarea.nextElementSibling;

  if (!(preview instanceof HTMLDivElement)) {
    return;
  }

  const sourceMax = Math.max(1, textarea.scrollHeight - textarea.clientHeight);
  const targetMax = Math.max(1, preview.scrollHeight - preview.clientHeight);
  preview.scrollTop = (textarea.scrollTop / sourceMax) * targetMax;
}

function getEditorHeight(measuredHeight: number) {
  return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, measuredHeight + BODY_LINE_HEIGHT * EDITOR_HEIGHT_BUFFER_LINES));
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}
