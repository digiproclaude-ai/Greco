"use client";

import { Paperclip, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormStatus } from "@/components/forms/fields";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

// Mirrors the database's "secret" signal closely enough to warn before sending.
const SECRET = /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)|((password|passwd|api[ _-]?key|secret)\s*[:=]\s*\S+)/i;

export function Composer({
  action,
  maxFiles,
  maxMb,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  maxFiles: number;
  maxMb: number;
}) {
  const t = useTranslations("inbox.composer");
  const [state, formAction] = useActionState(action, idleState);
  const form = useRef<HTMLFormElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      form.current?.reset();
      body.current?.focus();
    }
  }, [state]);

  return (
    <form
      ref={form}
      action={formAction}
      className="grid gap-3 border-t border-line bg-surface p-4"
      onSubmit={(event) => {
        const text = body.current?.value ?? "";
        if (SECRET.test(text) && !window.confirm(t("secretConfirm"))) event.preventDefault();
      }}
    >
      <FormStatus state={state} />
      <Label htmlFor="message-body" className="sr-only">
        {t("label")}
      </Label>
      <Textarea
        ref={body}
        id="message-body"
        name="body"
        rows={3}
        maxLength={5000}
        placeholder={t("placeholder")}
        aria-describedby="message-hint"
        defaultValue={state.status === "error" ? (state.values?.body ?? "") : ""}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <p id="message-hint" className="text-xs text-ink-muted">
        {t("hint")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <Paperclip aria-hidden="true" className="size-4" />
          <span>{t("files")}</span>
          <input name="files" type="file" multiple className="max-w-56 text-sm" aria-describedby="files-hint" />
        </label>
        <SubmitButton size="sm">
          <Send aria-hidden="true" />
          {t("send")}
        </SubmitButton>
      </div>
      <p id="files-hint" className="text-xs text-ink-muted">
        {t("filesHint", { count: maxFiles, max: maxMb })}
      </p>
    </form>
  );
}
