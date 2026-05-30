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

export function toSlug(input: string): string {
  const transliterated = transliterateHan(input);

  return transliterated
    .trim()
    .toLowerCase()
    .replace(SLUG_UNSAFE_PATTERN, "-")
    .replace(SLUG_TRIM_PATTERN, "");
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

export function createExcerpt(content: string): string {
  const plainText = plainTextFromMarkdown(content);

  if (plainText.length <= MAX_EXCERPT_LENGTH) {
    return plainText;
  }

  return `${plainText.slice(0, MAX_EXCERPT_LENGTH).trim()}...`;
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
