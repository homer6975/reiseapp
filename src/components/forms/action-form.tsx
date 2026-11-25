"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  submitVariant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  resetOnSuccess?: boolean;
  confirm?: string;
  className?: string;
  "aria-label"?: string;
  onSuccess?: () => void;
};

// Formular für Server Actions mit Fehlermeldung und Lade-Zustand.
export function ActionForm({
  action,
  children,
  submitLabel,
  submitVariant = "default",
  resetOnSuccess = false,
  confirm,
  className,
  "aria-label": ariaLabel,
  onSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
    if (state?.ok) onSuccessRef.current?.();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      aria-label={ariaLabel}
      className={cn("space-y-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={submitVariant} disabled={pending}>
          {submitLabel}
        </Button>
        {state?.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn(
              "text-sm",
              state.ok ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
