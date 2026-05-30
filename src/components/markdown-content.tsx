import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/code-block";

type MarkdownContentProps = {
  readonly content: string;
  readonly headingIds?: boolean;
};

const markdownComponents: Components = {
  a({ href, children }) {
    const external = Boolean(href?.startsWith("http"));

    return (
      <a href={href} rel={external ? "noreferrer" : undefined} target={external ? "_blank" : undefined}>
        {children}
      </a>
    );
  },
  code({ children, className }) {
    const language = getCodeLanguage(className);

    if (language) {
      return <CodeBlock code={String(children).replace(/\n$/, "")} language={language} />;
    }

    return <code className={className}>{children}</code>;
  },
  img({ alt, src, title }) {
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt ?? ""} src={src ?? ""} title={title} />
        {alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    );
  },
  input(props) {
    return <input {...props} readOnly />;
  },
  table({ children }) {
    return (
      <div className="markdown-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
};

export function MarkdownContent({ content, headingIds = true }: MarkdownContentProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={headingIds ? [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]] : []}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function getCodeLanguage(className: string | undefined) {
  return /language-(\S+)/.exec(className ?? "")?.[1];
}
