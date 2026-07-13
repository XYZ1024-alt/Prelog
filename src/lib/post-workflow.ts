export const POST_WRITE_CONFLICT_MESSAGE = "文章已被其他页面修改，请刷新后确认最新内容再重试。";

export type PostPreviewLinkState =
  | { readonly status: "idle" }
  | { readonly message: string; readonly status: "error" }
  | {
    readonly expiresAt: string;
    readonly href: string;
    readonly status: "success";
  };

export type PostMutationState =
  | { readonly status: "idle" }
  | { readonly message: string; readonly status: "error" }
  | { readonly href: string; readonly status: "success" };
