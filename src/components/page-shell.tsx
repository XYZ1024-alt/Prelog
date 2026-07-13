type PageShellProps = {
  readonly children: React.ReactNode;
  readonly className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return <main className={className ? `page-shell ${className}` : "page-shell"}>{children}</main>;
}
