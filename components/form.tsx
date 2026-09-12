"use client";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { mutate } from "@/lib/actions";
import { Button } from "./ui/button";
export function Submit({
  children = "Salvar",
  variant = "default",
}: {
  children?: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Salvando…" : children}
    </Button>
  );
}
export function ActionForm({
  kind,
  children,
  className = "",
  ...hidden
}: {
  kind: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const [state, action] = useActionState(mutate, { ok: false, message: "" });
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.redirect) router.push(state.redirect);
  }, [state, router]);
  return (
    <form action={action} className={`action-form ${className}`}>
      <input type="hidden" name="kind" value={kind} />
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={String(value)} />
      ))}
      {children}
      {state.message && (
        <p
          role="status"
          className={state.ok ? "feedback success" : "feedback error"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
