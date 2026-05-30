import { addComment } from "@/app/posts/[slug]/actions";

type CommentFormProps = {
  readonly parentId?: string;
  readonly postId: string;
  readonly replyTo?: string;
  readonly slug: string;
};

export function CommentForm({ parentId, postId, replyTo, slug }: CommentFormProps) {
  return (
    <form action={addComment} className={parentId ? "comment-form comment-form--reply" : "comment-form"}>
      <input name="postId" type="hidden" value={postId} />
      <input name="slug" type="hidden" value={slug} />
      {parentId ? <input name="parentId" type="hidden" value={parentId} /> : null}
      <label className="comment-form__website">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      {replyTo ? <p className="comment-form__hint">回复 {replyTo}</p> : null}
      <div className="form-grid">
        <label>
          昵称
          <input name="author" required />
        </label>
        <label>
          邮箱
          <input name="email" required type="email" />
        </label>
      </div>
      <label>
        评论
        <textarea name="body" required rows={parentId ? 3 : 5} />
      </label>
      <button className="button button--primary" type="submit">
        提交审核
      </button>
    </form>
  );
}
