import type { ReactNode } from "react";

type ButtonStateContentProps = {
  readonly children: ReactNode;
  readonly pending: boolean;
  readonly pendingChildren: ReactNode;
};

export function ButtonStateContent({ children, pending, pendingChildren }: ButtonStateContentProps) {
  return (
    <>
      <span className="submit-button__content">
        <span aria-hidden={pending} className="submit-button__state submit-button__state--idle">
          {children}
        </span>
        <span aria-hidden={!pending} className="submit-button__state submit-button__state--pending">
          <span aria-hidden="true" className="button__spinner" />
          {pendingChildren}
        </span>
      </span>
      <span aria-live="polite" className="submit-button__live">
        {pending ? pendingChildren : null}
      </span>
    </>
  );
}
