"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Bold, CheckSquare, Code2, Eye, Heading2, Image, Italic, Link, List, Pilcrow, Quote, Table2 } from "lucide-react";
import { layout, prepare } from "@chenglou/pretext";

import { MarkdownContent } from "@/components/markdown-content";
import { useClientMounted } from "@/components/use-client-mounted";
import { analyzeEditorial, type EditorialReport } from "@/lib/editorial-engine";
import { estimateReadingMinutes, plainTextFromMarkdown } from "@/lib/text";

type EditorMode = "write" | "preview";

export type DraftControls = {
  readonly clear: () => void;
  readonly hasRemoteDraft: boolean;
  readonly restore: () => void;
  readonly status: string;
};

type MarkdownEditorProps = {
  readonly draft: DraftControls;
  readonly excerpt: string;
  readonly setValue: (value: string) => void;
  readonly title: string;
  readonly value: string;
};

type DocumentStats = {
  readonly chars: number;
  readonly height: number;
  readonly lines: number;
  readonly minutes: number;
};

type EditorStats = DocumentStats & {
  readonly cursorLine: number;
  readonly paragraph: ParagraphInsight;
};

type ParagraphInsight = {
  readonly averageCharsPerLine: number;
  readonly chars: number;
  readonly lines: number;
  readonly message: string;
};

const BODY_FONT = '16px "SFMono-Regular", Consolas, monospace';
const BODY_LINE_HEIGHT = 26;
const MIN_MEASURE_WIDTH = 280;
const TEXTAREA_HORIZONTAL_PADDING = 26;
const EDITOR_MIN_HEIGHT = 560;
const EDITOR_MAX_HEIGHT = 900;
const EDITOR_HEIGHT_BUFFER_LINES = 4;
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

export function MarkdownEditor({ draft, excerpt, setValue, title, value }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>("write");
  const [editorWidth, setEditorWidth] = useState(MIN_MEASURE_WIDTH);
  const [cursor, setCursor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mounted = useClientMounted();
  const deferredValue = useDeferredValue(value);
  const deferredTitle = useDeferredValue(title);
  const deferredExcerpt = useDeferredValue(excerpt);
  const documentStats = useMemo(
    () => createDocumentStats({ markdown: deferredValue, mounted, width: editorWidth }),
    [deferredValue, editorWidth, mounted],
  );
  const currentStats = useMemo(
    () => createCurrentStats({ cursor, markdown: value, mounted, width: editorWidth }),
    [cursor, editorWidth, mounted, value],
  );
  const report = useMemo(
    () => getReport({ editorWidth, excerpt: deferredExcerpt, mounted, title: deferredTitle, value: deferredValue }),
    [deferredExcerpt, deferredTitle, deferredValue, editorWidth, mounted],
  );
  const stats = { ...documentStats, ...currentStats };

  useTextareaWidth(textareaRef, setEditorWidth);

  return (
    <section className="markdown-editor">
      <EditorHeader draft={draft} mode={mode} report={report} setMode={setMode} stats={stats} />
      <Toolbar onInsert={(before, after) => insertAroundSelection({ after, before, setCursor, setValue, textarea: textareaRef.current })} />
      <EditorWorkspace
        mode={mode}
        previewRef={previewRef}
        previewValue={deferredValue}
        setCursor={setCursor}
        setValue={setValue}
        stats={stats}
        textareaRef={textareaRef}
        value={value}
      />
      <EditorialPanel report={report} stats={stats} />
    </section>
  );
}

function EditorHeader({ draft, mode, report, setMode, stats }: {
  readonly draft: DraftControls;
  readonly mode: EditorMode;
  readonly report: EditorialReport | null;
  readonly setMode: (mode: EditorMode) => void;
  readonly stats: EditorStats;
}) {
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
      {draft.hasRemoteDraft ? <button onClick={draft.restore} type="button">恢复草稿</button> : null}
      {draft.hasRemoteDraft ? <button onClick={draft.clear} type="button">清除</button> : null}
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

function EditorWorkspace(props: {
  readonly mode: EditorMode;
  readonly previewRef: RefObject<HTMLDivElement | null>;
  readonly previewValue: string;
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly stats: EditorStats;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
}) {
  const { mode, previewRef, previewValue, setCursor, setValue, stats, textareaRef, value } = props;

  return (
    <>
      <input name="content" type="hidden" value={value} />
      <div className={mode === "preview" ? "markdown-editor__workspace is-preview" : "markdown-editor__workspace"}>
        {mode === "write" ? <EditorTextarea setCursor={setCursor} setValue={setValue} stats={stats} textareaRef={textareaRef} value={value} /> : null}
        <div className="markdown-editor__preview" ref={previewRef}>
          <MarkdownContent content={previewValue || "## 预览\n\n开始输入 Markdown 后，这里会实时渲染。"} />
        </div>
      </div>
    </>
  );
}

function EditorTextarea({ setCursor, setValue, stats, textareaRef, value }: {
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly stats: EditorStats;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
}) {
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

function getReport(options: { readonly editorWidth: number; readonly excerpt: string; readonly mounted: boolean; readonly title: string; readonly value: string }) {
  if (!options.mounted) {
    return null;
  }

  return analyzeEditorial({ title: options.title, excerpt: options.excerpt, markdown: options.value, width: options.editorWidth });
}

function createDocumentStats({ markdown, mounted, width }: { readonly markdown: string; readonly mounted: boolean; readonly width: number }): DocumentStats {
  const plainText = plainTextFromMarkdown(markdown);
  const layoutStats = mounted ? measureMarkdown({ markdown, width }) : { lines: 0, height: 0 };

  return { chars: plainText.length, minutes: estimateReadingMinutes(markdown), ...layoutStats };
}

function createCurrentStats({ cursor, markdown, mounted, width }: {
  readonly cursor: number;
  readonly markdown: string;
  readonly mounted: boolean;
  readonly width: number;
}): Pick<EditorStats, "cursorLine" | "paragraph"> {
  const paragraph = mounted ? measureCurrentParagraph({ cursor, markdown, width }) : createEmptyParagraphInsight();
  return { cursorLine: getCursorLine(markdown, cursor), paragraph };
}

function insertAroundSelection(options: {
  readonly after: string;
  readonly before: string;
  readonly setCursor: (cursor: number) => void;
  readonly setValue: (value: string) => void;
  readonly textarea: HTMLTextAreaElement | null;
}) {
  const { after, before, setCursor, setValue, textarea } = options;

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
