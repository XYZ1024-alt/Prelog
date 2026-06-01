import type { Category } from "@/generated/prisma/client";
import { SubmitButton } from "@/components/submit-button";

type CategoryEditorProps = {
  readonly action: (formData: FormData) => Promise<void>;
  readonly category?: Category;
};

export function CategoryEditor({ action, category }: CategoryEditorProps) {
  return (
    <form action={action} className="post-editor">
      {category ? <input name="id" type="hidden" value={category.id} /> : null}
      <div className="form-grid">
        <label>
          名称
          <input defaultValue={category?.name} name="name" required />
        </label>
        <label>
          Slug
          <input defaultValue={category?.slug} name="slug" placeholder="留空时根据名称生成拼音 slug" />
        </label>
      </div>
      <label>
        描述
        <textarea defaultValue={category?.description ?? ""} name="description" rows={4} />
      </label>
      <SubmitButton className="button button--primary" pendingChildren="保存中...">
        保存
      </SubmitButton>
    </form>
  );
}
