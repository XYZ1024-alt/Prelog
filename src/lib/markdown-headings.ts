import GithubSlugger from "github-slugger";

export type MarkdownHeading = {
  readonly id: string;
  readonly level: number;
  readonly text: string;
};

const HEADING_PATTERN = /^(#{2,3})\s+(.+?)\s*#*\s*$/gm;
const INLINE_MARKDOWN_PATTERN = /[`*_~[\]()]/g;

export function getMarkdownHeadings(markdown: string) {
  const slugger = new GithubSlugger();
  const headings: MarkdownHeading[] = [];

  for (const match of markdown.matchAll(HEADING_PATTERN)) {
    const text = cleanHeadingText(match[2]);
    const id = createHeadingId(text, slugger);
    headings.push({ id, level: match[1].length, text });
  }

  return headings;
}

export function cleanHeadingText(value: string) {
  return value.replace(INLINE_MARKDOWN_PATTERN, "").trim();
}

export function createHeadingId(text: string, slugger: GithubSlugger) {
  return slugger.slug(text) || "section";
}
