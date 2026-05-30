"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { layout, prepare } from "@chenglou/pretext";

import { useClientMounted } from "@/components/use-client-mounted";
import { toSlug } from "@/lib/text";

type TypographicAsciiProps = {
  text: string;
  tone?: "hero" | "compact";
};

type AsciiMetrics = {
  block: string;
  size: number;
  weight: number;
};

const ASCII_FONT = '16px "SFMono-Regular", Consolas, monospace';
const ASCII_LINE_HEIGHT = 18;
const HERO_ROWS = 10;
const COMPACT_ROWS = 5;
const MIN_WIDTH = 220;
const DENSE_STEP = 2;
const NORMAL_STEP = 3;
const LIGHT_STEP = 4;
const TEXT_FALLBACK = "PRELOG";

export function TypographicAscii({ text, tone = "hero" }: TypographicAsciiProps) {
  const ref = useRef<HTMLPreElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  const mounted = useClientMounted();
  const metrics = useMemo(() => createMetrics(text, width, tone, mounted), [mounted, text, tone, width]);

  useAsciiWidth(ref, setWidth);

  return (
    <pre
      aria-hidden="true"
      className={tone === "hero" ? "typographic-ascii typographic-ascii--hero" : "typographic-ascii"}
      ref={ref}
      style={{
        "--ascii-size": `${metrics.size}px`,
        "--ascii-weight": metrics.weight,
      } as React.CSSProperties}
    >
      {metrics.block}
    </pre>
  );
}

function createMetrics(text: string, width: number, tone: TypographicAsciiProps["tone"], mounted: boolean): AsciiMetrics {
  const source = normalizeSource(text);
  const rows = tone === "hero" ? HERO_ROWS : COMPACT_ROWS;
  const lineCount = mounted ? measureSourceLines(source, width) : 1;
  const step = getStep(lineCount, tone);
  const size = getSize(lineCount, tone);

  return {
    block: createAsciiBlock(source, rows, width, step),
    size,
    weight: lineCount > 2 ? 800 : 700,
  };
}

function normalizeSource(text: string) {
  const slug = toSlug(text).replaceAll("-", " ").toUpperCase();
  return slug || TEXT_FALLBACK;
}

function measureSourceLines(source: string, width: number) {
  const prepared = prepare(source, ASCII_FONT, { letterSpacing: 0.2 });
  return layout(prepared, Math.max(MIN_WIDTH, width), ASCII_LINE_HEIGHT).lineCount;
}

function getStep(lineCount: number, tone: TypographicAsciiProps["tone"]) {
  if (tone === "compact") {
    return lineCount > 1 ? NORMAL_STEP : LIGHT_STEP;
  }

  return lineCount > 2 ? DENSE_STEP : NORMAL_STEP;
}

function getSize(lineCount: number, tone: TypographicAsciiProps["tone"]) {
  if (tone === "compact") {
    return lineCount > 1 ? 12 : 13;
  }

  return lineCount > 2 ? 13 : 15;
}

function createAsciiBlock(source: string, rows: number, width: number, step: number) {
  const columns = getColumnCount(width);
  const chars = source.replace(/\s+/g, " ").trim();

  return Array.from({ length: rows }, (_, row) => createAsciiLine(chars, columns, row, step)).join("\n");
}

function createAsciiLine(chars: string, columns: number, row: number, step: number) {
  return Array.from({ length: columns }, (_, column) => getAsciiChar(chars, row, column, step)).join("");
}

function getAsciiChar(chars: string, row: number, column: number, step: number) {
  const index = (row * step + column) % chars.length;
  const char = chars[index];
  const spacer = (row + column) % step === 0;

  return spacer ? " " : char;
}

function getColumnCount(width: number) {
  return Math.max(24, Math.min(84, Math.floor(width / 9)));
}

function useAsciiWidth(ref: React.RefObject<HTMLPreElement | null>, setWidth: (width: number) => void) {
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
