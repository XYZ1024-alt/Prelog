import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/code-block";

type MarkdownContentProps = {
  readonly content: string;
};

const markdownComponents: Components = {
  a({ href, children }) {
    const external = Boolean(href?.startsWith("http"));

    return (
      <a href={href} rel={external ? "noopener noreferrer" : undefined} target={external ? "_blank" : undefined}>
        {children}
      </a>
    );
  },
  code({ children, className }) {
    return <code className={className}>{children}</code>;
  },
  img({ alt, src, title }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Markdown images remain browser-direct and use no-referrer.
      <img
        alt={alt ?? ""}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={src ?? ""}
        title={title}
      />
    );
  },
  input({ node, ...props }) {
    if (!node) {
      throw new Error("Markdown task-list input node is unavailable.");
    }

    return <input {...props} readOnly />;
  },
  p({ children, node }) {
    if (!node) {
      throw new Error("Markdown paragraph node is unavailable.");
    }

    const meaningfulNodes = node.children.filter((child) => child.type !== "text" || child.value.trim());
    const standaloneImage = meaningfulNodes.length === 1
      && meaningfulNodes[0].type === "element"
      && meaningfulNodes[0].tagName === "img";

    if (!standaloneImage) {
      return <p>{children}</p>;
    }

    const image = Children.toArray(children).find((child) => isValidElement(child));

    if (!isValidElement<{ alt?: string }>(image)) {
      throw new Error("Markdown image paragraph did not render an image element.");
    }

    return (
      <figure>
        {image}
        {image.props.alt ? <figcaption>{image.props.alt}</figcaption> : null}
      </figure>
    );
  },
  table({ children }) {
    return (
      <div className="markdown-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }) {
    const codeElement = Children.toArray(children).find((child) => isValidElement(child));

    if (!isValidElement<{ children?: ReactNode; className?: string }>(codeElement)) {
      throw new Error("Markdown code block did not render a code element.");
    }

    return (
      <CodeBlock
        code={String(codeElement.props.children ?? "").replace(/\n$/, "")}
        language={getCodeLanguage(codeElement.props.className)}
      />
    );
  },
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
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
