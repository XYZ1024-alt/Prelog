"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  readonly pendingChildren?: ReactNode;
};

export function SubmitButton({
  children,
  disabled,
  pendingChildren = "处理中...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button aria-busy={pending} disabled={isDisabled} type="submit" {...props}>
      {pending ? pendingChildren : children}
    </button>
  );
}
