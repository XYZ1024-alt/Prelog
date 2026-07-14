import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  readonly actions?: ReactNode;
  readonly label: string;
  readonly title: string;
};

export function AdminPageHeader({ actions, label, title }: AdminPageHeaderProps) {
  return (
    <header className="admin-panel__head">
      <div>
        <span className="eyebrow">{label}</span>
        <h1>{title}</h1>
      </div>
      {actions ? <div className="admin-panel__actions">{actions}</div> : null}
    </header>
  );
}
