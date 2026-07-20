"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { layout, prepare } from "@chenglou/pretext";

import { SYSTEM_SANS_FONT_STACK } from "@/lib/font-stack";

type PretextFitTitleProps = {
  readonly href: string;
  readonly title: string;
};

const TITLE_FONT = `800 26px ${SYSTEM_SANS_FONT_STACK}`;
const COMPACT_TITLE_FONT = `800 24px ${SYSTEM_SANS_FONT_STACK}`;
const LINE_HEIGHT = 31;
const COMPACT_LINE_HEIGHT = 29;
const MIN_WIDTH = 180;
const COMPACT_LINE_THRESHOLD = 2;
const DENSE_LINE_THRESHOLD = 3;

export function PretextFitTitle({ href, title }: PretextFitTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [width, setWidth] = useState(0);
  const density = useMemo(() => getDensity({ title, width }), [title, width]);

  useMeasuredWidth(ref, setWidth);

  return (
    <h2 className={`pretext-fit-title ${density}`} ref={ref}>
      <Link href={href}>
        {title}
      </Link>
    </h2>
  );
}

function getDensity({ title, width }: { readonly title: string; readonly width: number }) {
  if (width <= 0) {
    return "is-normal";
  }

  const normalLines = measureLines({ font: TITLE_FONT, lineHeight: LINE_HEIGHT, title, width });

  if (normalLines <= COMPACT_LINE_THRESHOLD) {
    return "is-normal";
  }

  const compactLines = measureLines({ font: COMPACT_TITLE_FONT, lineHeight: COMPACT_LINE_HEIGHT, title, width });
  return compactLines > DENSE_LINE_THRESHOLD ? "is-dense" : "is-compact";
}

function measureLines({ font, lineHeight, title, width }: { readonly font: string; readonly lineHeight: number; readonly title: string; readonly width: number }) {
  const prepared = prepare(title, font, { letterSpacing: 0, whiteSpace: "normal" });
  return layout(prepared, Math.max(MIN_WIDTH, width), lineHeight).lineCount;
}

function useMeasuredWidth(ref: React.RefObject<HTMLElement | null>, setWidth: (width: number) => void) {
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
