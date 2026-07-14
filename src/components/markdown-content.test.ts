import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "@/components/markdown-content";

const COMPLEX_MARKDOWN = `Paragraph with [a link](https://example.com), **bold**, *emphasis*, and \`inline code\`.

![System diagram](https://example.com/diagram.png "Diagram title")

> A quote with **meaning** and [context](https://example.com/context).

1. First ordered item
2. Second ordered item

- [x] Finished task
- [ ] Open task

| Layer | Role |
| --- | --- |
| UI | Reading |

\`\`\`ts
const ready = true;
\`\`\`

\`\`\`
first line

second line
\`\`\``;

describe("MarkdownContent", () => {
  it("preserves rich Markdown semantics in one valid article tree", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { content: COMPLEX_MARKDOWN }));

    expect(html).toContain(">a link</a>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<code>inline code</code>");
    expect(html).toContain("<figure>");
    expect(html).toContain("<figcaption>System diagram</figcaption>");
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).not.toContain("<p><figure>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<ol>");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('node="[object Object]"');
    expect(html).toContain('class="markdown-table-wrap"');
    expect(html.match(/class="code-block"/g)).toHaveLength(2);
    expect(html).toContain("<span>TypeScript</span>");
    expect(html).toContain("<span>代码</span>");
    expect(html).toContain("first line\n\nsecond line");
  });
});
