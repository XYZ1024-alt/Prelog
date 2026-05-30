"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
} from "@chenglou/pretext";

import { CodeBlock } from "@/components/code-block";
import { MarkdownContent } from "@/components/markdown-content";
import { useClientMounted } from "@/components/use-client-mounted";
import { cleanHeadingText, createHeadingId } from "@/lib/markdown-headings";
import GithubSlugger from "github-slugger";

type DynamicArticleLayoutProps = {
  content: string;
};

type ContentBlock =
  | { kind: "heading"; text: string; level: number; id?: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "image"; alt: string; src: string }
  | { kind: "code"; text: string; language?: string }
  | { kind: "list"; items: string[] };

type DynamicLine = {
  text: string;
  indent: number;
  width: number;
};

const BODY_FONT = '18px "Inter", "Noto Sans SC", Arial';
const BODY_LINE_HEIGHT = 32;
const MIN_DYNAMIC_WIDTH = 720;
const FLOAT_WIDTH = 236;
const FLOAT_GAP = 26;
const FLOAT_HEIGHT = 172;
const MIN_TEXT_WIDTH = 300;
const MAX_DYNAMIC_PARAGRAPHS = 4;
const HEADING_PREFIX = "#";
const IMAGE_PATTERN = /^!\[(?<alt>[^\]]*)\]\((?<src>[^)]+)\)$/;

export function DynamicArticleLayout({ content }: DynamicArticleLayoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const mounted = useClientMounted();
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const dynamic = useMemo(() => createDynamicLayout(blocks, width, mounted), [blocks, mounted, width]);

  useContainerWidth(ref, setWidth);

  return (
    <div className="dynamic-article" ref={ref}>
      {dynamic ? (
        <div className="dynamic-article__semantic">
          <MarkdownContent content={content} headingIds={false} />
        </div>
      ) : null}
      {dynamic ? <DynamicArticleView blocks={blocks} dynamic={dynamic} /> : <MarkdownContent content={content} />}
    </div>
  );
}

function DynamicArticleView({
  blocks,
  dynamic,
}: {
  blocks: ContentBlock[];
  dynamic: Map<number, DynamicLine[]>;
}) {
  return (
    <article aria-hidden="true" className="dynamic-article__body">
      {blocks.map((block, index) => (
        <DynamicBlock block={block} key={`${block.kind}-${index}`} lines={dynamic.get(index)} />
      ))}
    </article>
  );
}

function DynamicBlock({ block, lines }: { block: ContentBlock; lines?: DynamicLine[] }) {
  if (block.kind === "heading") {
    const Heading = `h${Math.min(3, block.level)}` as "h1" | "h2" | "h3";
    return <Heading id={block.id}>{block.text}</Heading>;
  }

  if (block.kind === "quote") {
    return <blockquote>{block.text}</blockquote>;
  }

  if (block.kind === "image") {
    return <DynamicImage alt={block.alt} src={block.src} />;
  }

  if (block.kind === "code") {
    return <CodeBlock code={block.text} language={block.language} />;
  }

  if (block.kind === "list") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (lines) {
    return <DynamicParagraph lines={lines} />;
  }

  return <p>{block.text}</p>;
}

function DynamicParagraph({ lines }: { lines: DynamicLine[] }) {
  return (
    <p className="dynamic-paragraph">
      {lines.map((line, index) => (
        <span
          key={`${line.text}-${index}`}
          style={{ marginLeft: line.indent, maxWidth: line.width }}
        >
          {line.text}
        </span>
      ))}
    </p>
  );
}

function DynamicImage({ alt, src }: { alt: string; src: string }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} src={src} />
      {alt ? <figcaption>{alt}</figcaption> : null}
    </figure>
  );
}

function createDynamicLayout(blocks: ContentBlock[], width: number, mounted: boolean) {
  if (!mounted || width < MIN_DYNAMIC_WIDTH) {
    return null;
  }

  const dynamic = new Map<number, DynamicLine[]>();
  const floatIndex = getFloatAnchorIndex(blocks);

  if (floatIndex === -1) {
    return null;
  }

  let paragraphCount = 0;

  blocks.forEach((block, index) => {
    if (block.kind !== "paragraph" || paragraphCount >= MAX_DYNAMIC_PARAGRAPHS) {
      return;
    }

    dynamic.set(index, layoutParagraph(block.text, width, index > floatIndex));
    paragraphCount += 1;
  });

  return dynamic;
}

function layoutParagraph(text: string, width: number, besideFloat: boolean) {
  const prepared = prepareWithSegments(text, BODY_FONT, { whiteSpace: "normal", letterSpacing: 0.05 });
  const lines: DynamicLine[] = [];
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

  while (true) {
    const lineBesideFloat = besideFloat && lines.length * BODY_LINE_HEIGHT < FLOAT_HEIGHT;
    const availableWidth = lineBesideFloat ? width - FLOAT_WIDTH - FLOAT_GAP : width;
    const range = layoutNextLineRange(prepared, cursor, Math.max(MIN_TEXT_WIDTH, availableWidth));

    if (!range) {
      return lines;
    }

    const line = materializeLineRange(prepared, range);
    lines.push({
      text: line.text,
      indent: lineBesideFloat ? FLOAT_WIDTH + FLOAT_GAP : 0,
      width: range.width,
    });
    cursor = range.end;
  }
}

function parseMarkdownBlocks(markdown: string) {
  const slugger = new GithubSlugger();
  const rawBlocks = markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return rawBlocks.map((block) => parseMarkdownBlock(block, slugger));
}

function parseMarkdownBlock(block: string, slugger: GithubSlugger): ContentBlock {
  const image = IMAGE_PATTERN.exec(block);

  if (image?.groups) {
    return { kind: "image", alt: image.groups.alt, src: image.groups.src };
  }

  if (block.startsWith("```")) {
    return parseCodeBlock(block);
  }

  if (block.startsWith(">")) {
    return { kind: "quote", text: block.replace(/^>\s?/gm, "") };
  }

  if (block.startsWith(HEADING_PREFIX)) {
    return parseHeading(block, slugger);
  }

  if (/^[-*]\s/m.test(block)) {
    return { kind: "list", items: block.split("\n").map((item) => item.replace(/^[-*]\s+/, "")) };
  }

  return { kind: "paragraph", text: block.replace(/\n/g, " ") };
}

function parseCodeBlock(block: string): ContentBlock {
  const match = /^```(?<language>[^\s`]*)\n?(?<code>[\s\S]*?)\n?```$/.exec(block);

  if (!match?.groups) {
    return { kind: "code", text: block.replace(/^```[^\n]*\n?/i, "").replace(/\n?```$/, "") };
  }

  return {
    kind: "code",
    language: match.groups.language || undefined,
    text: match.groups.code,
  };
}

function parseHeading(block: string, slugger: GithubSlugger): ContentBlock {
  const marker = block.match(/^#+/)?.[0] ?? HEADING_PREFIX;
  const text = cleanHeadingText(block.replace(/^#+\s*/, ""));
  const id = marker.length > 1 ? createHeadingId(text, slugger) : undefined;

  return {
    id,
    kind: "heading",
    level: marker.length,
    text,
  };
}

function getFloatAnchorIndex(blocks: ContentBlock[]) {
  const imageIndex = blocks.findIndex((block) => block.kind === "image");

  if (imageIndex !== -1) {
    return imageIndex;
  }

  return blocks.findIndex((block) => block.kind === "quote");
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>, setWidth: (width: number) => void) {
  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    setWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref, setWidth]);
}
