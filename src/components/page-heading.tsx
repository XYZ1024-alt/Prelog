import type { LucideIcon } from "lucide-react";

type PageHeadingProps = {
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly label: string;
  readonly title: string;
};

export function PageHeading({ description, icon: Icon, label, title }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <span className="eyebrow">
        {Icon ? <Icon aria-hidden="true" size={16} /> : null}
        {label}
      </span>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
