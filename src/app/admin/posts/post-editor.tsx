"use client";

import { useState } from "react";

import { MarkdownEditor } from "@/app/admin/posts/markdown-editor";
import type { Category, Post, PostTag, Tag } from "@/generated/prisma/client";

type PostWithTags = Post & {
  readonly tags: (PostTag & { readonly tag: Tag })[];
};

type EditorProps = {
  readonly action: (formData: FormData) => Promise<void>;
  readonly categories: readonly Category[];
  readonly post?: PostWithTags;
};

export function PostEditor({ action, categories, post }: EditorProps) {
  const tagNames = post?.tags.map(({ tag }) => tag.name).join(", ") ?? "";
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const draftKey = post ? `post:${post.id}` : "post:new";

  return (
    <form action={action} className="post-editor">
      {post ? <input name="id" type="hidden" value={post.id} /> : null}
      <div className="form-grid">
        <label>
          标题
          <input name="title" onChange={(event) => setTitle(event.target.value)} required value={title} />
        </label>
        <label>
          Slug
          <input defaultValue={post?.slug} name="slug" placeholder="留空时根据标题生成拼音 slug" />
        </label>
      </div>
      <label>
        摘要
        <textarea name="excerpt" onChange={(event) => setExcerpt(event.target.value)} rows={3} value={excerpt} />
      </label>
      <div className="form-grid">
        <label>
          分类
          <select defaultValue={post?.categoryId ?? ""} name="categoryId">
            <option value="">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          标签
          <input defaultValue={tagNames} name="tagNames" placeholder="Next.js, Pretext" />
        </label>
      </div>
      <label>
        封面图 URL
        <input defaultValue={post?.coverImage ?? ""} name="coverImage" type="url" />
      </label>
      <MarkdownEditor defaultValue={post?.content} draftKey={draftKey} excerpt={excerpt} title={title} />
      <div className="form-grid">
        <label>
          SEO 标题
          <input defaultValue={post?.seoTitle ?? ""} name="seoTitle" />
        </label>
        <label>
          SEO 描述
          <input defaultValue={post?.seoDescription ?? ""} name="seoDescription" />
        </label>
      </div>
      <label>
        状态
        <select defaultValue={post?.status ?? "DRAFT"} name="status">
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">发布</option>
        </select>
      </label>
      <button className="button button--primary" type="submit">
        保存
      </button>
    </form>
  );
}
