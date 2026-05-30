import { layout, prepare } from "@chenglou/pretext";

import { estimateReadingMinutes, plainTextFromMarkdown } from "@/lib/text";

export type EditorialInput = {
  readonly title: string;
  readonly excerpt: string;
  readonly markdown: string;
  readonly width: number;
};

export type EditorialFinding = {
  readonly level: "good" | "warn" | "info";
  readonly message: string;
};

export type EditorialReport = {
  readonly averageCharsPerLine: number;
  readonly bodyWidth: number;
  readonly contentLines: number;
  readonly excerptLines: number;
  readonly findings: EditorialFinding[];
  readonly readingMinutes: number;
  readonly score: number;
  readonly titleLines: number;
};

const TITLE_FONT = '700 28px "Inter", "Noto Sans SC", Arial';
const EXCERPT_FONT = '16px "Inter", "Noto Sans SC", Arial';
const BODY_FONT = '16px "SFMono-Regular", Consolas, monospace';
const TITLE_LINE_HEIGHT = 34;
const EXCERPT_LINE_HEIGHT = 26;
const BODY_LINE_HEIGHT = 26;
const TITLE_MEASURE_WIDTH = 560;
const EXCERPT_MEASURE_WIDTH = 620;
const BODY_MIN_WIDTH = 300;
const BODY_HORIZONTAL_PADDING = 26;
const IDEAL_TITLE_MAX_LINES = 2;
const IDEAL_EXCERPT_MIN = 60;
const IDEAL_EXCERPT_MAX = 180;
const LONG_PARAGRAPH_LIMIT = 320;
const MIN_SECTION_COUNT = 2;
const SCORE_MAX = 100;
const SCORE_STEP = 8;

export function analyzeEditorial(input: EditorialInput): EditorialReport {
  const bodyWidth = getBodyWidth(input.width);
  const titleLines = measureTextLines({ font: TITLE_FONT, lineHeight: TITLE_LINE_HEIGHT, text: input.title, width: TITLE_MEASURE_WIDTH });
  const excerptLines = measureTextLines({ font: EXCERPT_FONT, lineHeight: EXCERPT_LINE_HEIGHT, text: input.excerpt, width: EXCERPT_MEASURE_WIDTH });
  const contentLines = measureTextLines({ font: BODY_FONT, lineHeight: BODY_LINE_HEIGHT, text: input.markdown, width: bodyWidth });
  const averageCharsPerLine = getAverageCharsPerLine(input.markdown, contentLines);
  const findings = createFindings({ ...input, averageCharsPerLine, bodyWidth, excerptLines, titleLines });

  return {
    averageCharsPerLine,
    bodyWidth,
    contentLines,
    excerptLines,
    findings,
    readingMinutes: estimateReadingMinutes(input.markdown),
    score: scoreFindings(findings),
    titleLines,
  };
}

type FindingInput = EditorialInput & {
  readonly averageCharsPerLine: number;
  readonly bodyWidth: number;
  readonly excerptLines: number;
  readonly titleLines: number;
};

function createFindings(input: FindingInput) {
  return [
    titleFinding(input.title, input.titleLines),
    excerptFinding(input.excerpt, input.excerptLines),
    headingFinding(input.markdown, input.title),
    structureFinding(input.markdown),
    measureFinding(input.bodyWidth, input.averageCharsPerLine),
    paragraphFinding(input.markdown),
    mediaFinding(input.markdown),
    codeFinding(input.markdown),
  ];
}

function measureFinding(bodyWidth: number, charsPerLine: number): EditorialFinding {
  if (charsPerLine > 42) {
    return { level: "warn", message: "当前预览宽度下平均行长偏长，建议拆分长句或用小标题降低阅读压力。" };
  }

  if (bodyWidth < 420) {
    return { level: "info", message: "当前编辑区域较窄，Pretext 已按窄屏测量行数，建议也检查右侧预览。" };
  }

  return { level: "good", message: "正文行长处在舒适范围，适合桌面和移动端阅读。" };
}

function titleFinding(title: string, lines: number): EditorialFinding {
  if (!title.trim()) {
    return { level: "warn", message: "标题为空，发布前需要补上明确标题。" };
  }

  if (lines > IDEAL_TITLE_MAX_LINES) {
    return { level: "warn", message: "标题在常规卡片宽度下会超过两行，建议压缩或前置关键词。" };
  }

  return { level: "good", message: "标题长度适合列表、详情页和分享卡片。" };
}

function excerptFinding(excerpt: string, lines: number): EditorialFinding {
  const length = plainTextFromMarkdown(excerpt).length;

  if (length < IDEAL_EXCERPT_MIN) {
    return { level: "info", message: "摘要偏短，可以补一句文章解决的问题或读者能获得什么。" };
  }

  if (length > IDEAL_EXCERPT_MAX || lines > IDEAL_TITLE_MAX_LINES) {
    return { level: "warn", message: "摘要偏长，列表卡片和 SEO 描述会显得拥挤。" };
  }

  return { level: "good", message: "摘要长度适合首页卡片和 SEO 描述。" };
}

function headingFinding(markdown: string, title: string): EditorialFinding {
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (firstHeading && normalizeText(firstHeading) === normalizeText(title)) {
    return { level: "info", message: "正文开头的 H1 与文章标题重复，前台会自动隐藏重复标题。" };
  }

  return { level: "good", message: "正文标题层级与详情页标题没有明显重复。" };
}

function structureFinding(markdown: string): EditorialFinding {
  const sectionCount = markdown.match(/^##\s+/gm)?.length ?? 0;

  if (sectionCount < MIN_SECTION_COUNT) {
    return { level: "info", message: "正文分节较少，长文建议加入二级标题，方便目录和快速扫读。" };
  }

  return { level: "good", message: "正文结构清晰，适合目录和分段阅读。" };
}

function paragraphFinding(markdown: string): EditorialFinding {
  const longest = getLongestParagraph(markdown);

  if (longest > LONG_PARAGRAPH_LIMIT) {
    return { level: "warn", message: "存在较长段落，建议拆分，移动端阅读压力会更小。" };
  }

  return { level: "good", message: "段落长度稳定，阅读节奏正常。" };
}

function mediaFinding(markdown: string): EditorialFinding {
  const hasEditorialObject = /^>\s+|^!\[[^\]]*]\([^)]+/m.test(markdown);

  if (!hasEditorialObject) {
    return { level: "info", message: "可以加入引用或图片，让前台排版形成更自然的编辑重心。" };
  }

  return { level: "good", message: "已有引用或图片，前台会自动形成编辑式绕排。" };
}

function codeFinding(markdown: string): EditorialFinding {
  const unlabeledCode = /^```\s*$/m.test(markdown);

  if (unlabeledCode) {
    return { level: "info", message: "代码块建议补充语言名，例如 ```ts 或 ```prisma，前台会显示语言标识。" };
  }

  return { level: "good", message: "代码块语言信息完整或暂无代码块。" };
}

type MeasureOptions = {
  readonly font: string;
  readonly lineHeight: number;
  readonly text: string;
  readonly width: number;
};

function measureTextLines({ font, lineHeight, text, width }: MeasureOptions) {
  if (!text.trim()) {
    return 0;
  }

  const prepared = prepare(text, font, { letterSpacing: 0, whiteSpace: "pre-wrap" });
  return layout(prepared, width, lineHeight).lineCount;
}

function getBodyWidth(width: number) {
  return Math.max(BODY_MIN_WIDTH, width - BODY_HORIZONTAL_PADDING);
}

function getLongestParagraph(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => plainTextFromMarkdown(paragraph).length)
    .reduce((longest, length) => Math.max(longest, length), 0);
}

function scoreFindings(findings: readonly EditorialFinding[]) {
  const penalty = findings.filter((finding) => finding.level === "warn").length * SCORE_STEP;
  return Math.max(0, SCORE_MAX - penalty);
}

function getAverageCharsPerLine(markdown: string, lines: number) {
  const chars = plainTextFromMarkdown(markdown).length;
  return lines > 0 ? Math.round(chars / lines) : 0;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
