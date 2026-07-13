import {
  MAX_EXCERPT_LENGTH,
  MIN_READING_MINUTES,
  WORDS_PER_MINUTE,
} from "@/lib/constants";
import { pinyin } from "pinyin-pro";

const MARKDOWN_TOKEN_PATTERN = /[#>*_`~\-[\]()!]/g;
const SPACE_PATTERN = /\s+/g;
const SLUG_TRIM_PATTERN = /^-+|-+$/g;
const SLUG_UNSAFE_PATTERN = /[^\p{Letter}\p{Number}]+/gu;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const COMBINING_MARK_PATTERN = /\p{Mark}/gu;
const ASCII_ALPHANUMERIC_PATTERN = /[a-z0-9]/i;
const TITLE_INITIAL_FALLBACK = "P";
const TITLE_SEPARATOR_PATTERN = /^[\s:：,，.。\-–—|·]+/u;
const TITLE_INITIAL_PINYIN_OVERRIDES = [
  ["重构", "chong"],
] as const;

type ArticleDescriptionInput = {
  readonly excerpt: string;
  readonly title: string;
};

type MatchingHeadingInput = {
  readonly firstContentLineIndex: number;
  readonly lines: readonly string[];
  readonly normalizedTitle: string;
};

export function toSlug(input: string): string {
  const transliterated = transliterateHan(input);

  return transliterated
    .trim()
    .toLowerCase()
    .replace(SLUG_UNSAFE_PATTERN, "-")
    .replace(SLUG_TRIM_PATTERN, "");
}

export function createTitleInitial(title: string) {
  const normalized = title.normalize("NFKC").trim();
  const override = findTitlePhraseInitial(normalized);

  if (override) {
    return override;
  }

  const entries = pinyin(normalized, { pattern: "first", toneType: "none", type: "all" });

  for (const entry of entries) {
    const initial = findAsciiInitial(entry.isZh ? entry.first : entry.origin);

    if (initial) {
      return initial;
    }
  }

  return TITLE_INITIAL_FALLBACK;
}

function findTitlePhraseInitial(value: string) {
  const contentStart = value.search(/[\p{Letter}\p{Number}]/u);

  if (contentStart === -1) {
    return null;
  }

  const content = value.slice(contentStart);
  const match = TITLE_INITIAL_PINYIN_OVERRIDES.find(([phrase]) => content.startsWith(phrase));
  return match ? findAsciiInitial(match[1]) : null;
}

function findAsciiInitial(value: string) {
  return value
    .normalize("NFKD")
    .replace(COMBINING_MARK_PATTERN, "")
    .match(ASCII_ALPHANUMERIC_PATTERN)?.[0]
    .toUpperCase() ?? null;
}

function transliterateHan(input: string): string {
  return Array.from(input)
    .map((char) => (HAN_CHARACTER_PATTERN.test(char) ? ` ${pinyin(char, { toneType: "none", separator: "" })} ` : char))
    .join("");
}

export function decodeRouteSegment(segment: string): string {
  return decodeURIComponent(segment);
}

export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(MARKDOWN_TOKEN_PATTERN, " ")
    .replace(SPACE_PATTERN, " ")
    .trim();
}

export function createExcerpt(content: string, title?: string): string {
  const excerptSource = title ? stripLeadingTitleHeading(content, title) : content;
  const plainText = plainTextFromMarkdown(excerptSource);

  if (plainText.length <= MAX_EXCERPT_LENGTH) {
    return plainText;
  }

  return `${plainText.slice(0, MAX_EXCERPT_LENGTH).trim()}...`;
}

export function createArticleDescription({ excerpt, title }: ArticleDescriptionInput): string {
  const trimmedExcerpt = excerpt.trim();
  const trimmedTitle = title.trim();

  if (!trimmedTitle || !trimmedExcerpt.toLocaleLowerCase().startsWith(trimmedTitle.toLocaleLowerCase())) {
    return trimmedExcerpt;
  }

  const remainder = trimmedExcerpt.slice(trimmedTitle.length);

  if (!TITLE_SEPARATOR_PATTERN.test(remainder)) {
    return trimmedExcerpt;
  }

  return remainder.replace(TITLE_SEPARATOR_PATTERN, "").trim() || trimmedExcerpt;
}

export function stripLeadingTitleHeading(content: string, title: string): string {
  const normalizedTitle = normalizeHeadingText(title);
  const lines = content.split(/\r?\n/);
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) {
    return content;
  }

  return removeMatchingFirstHeading({ firstContentLineIndex, lines, normalizedTitle });
}

export function estimateReadingMinutes(content: string): number {
  const normalized = plainTextFromMarkdown(content);
  const cjkCount = countCjkCharacters(normalized);
  const latinWords = normalized.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const totalUnits = Math.max(cjkCount, latinWords);

  return Math.max(MIN_READING_MINUTES, Math.ceil(totalUnits / WORDS_PER_MINUTE));
}

function countCjkCharacters(input: string): number {
  return Array.from(input).filter((char) => /\p{Script=Han}/u.test(char)).length;
}

function removeMatchingFirstHeading({
  firstContentLineIndex,
  lines,
  normalizedTitle,
}: MatchingHeadingInput): string {
  const firstLine = lines[firstContentLineIndex].trim();
  const match = /^#\s+(.+)$/.exec(firstLine);

  if (!match || normalizeHeadingText(match[1]) !== normalizedTitle) {
    return lines.join("\n");
  }

  return lines
    .slice(0, firstContentLineIndex)
    .concat(lines.slice(firstContentLineIndex + 1))
    .join("\n")
    .trimStart();
}

function normalizeHeadingText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
