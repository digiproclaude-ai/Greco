"use client";

import { MessageSquare } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormStatus } from "@/components/forms/fields";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

/** Opens the conversation with the other person (the action redirects to it). */
export function ContactButton({
  action,
  label,
  variant = "secondary",
}: {
  action: () => Promise<ActionState>;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-2">
      <SubmitButton variant={variant} size="sm">
        <MessageSquare aria-hidden="true" />
        {label}
      </SubmitButton>
      {state.status === "error" ? <FormStatus state={state} /> : null}
    </form>
  );
}
