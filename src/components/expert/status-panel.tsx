import { getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";

/** Profile status with the latest statement of reasons when Greco asked for changes. */
export async function ProviderStatusPanel({
  status,
  lastDecision,
}: {
  status: string;
  lastDecision: { action: string; reason: string | null } | null;
}) {
  const t = await getTranslations("expert.status");
  const changesRequested = status === "draft" && lastDecision?.action === "reject" && lastDecision.reason;
  if (changesRequested) {
    return (
      <Alert variant="warning" title={t("changesRequested")}>
        <p className="whitespace-pre-line">{lastDecision.reason}</p>
      </Alert>
    );
  }
  const variant = status === "active" ? "success" : status === "suspended" ? "danger" : "info";
  const key = (["draft", "pending_review", "active", "suspended", "deactivated"] as const).find((s) => s === status) ?? "draft";
  return (
    <Alert variant={variant}>
      {t(key)}
      {status === "suspended" && lastDecision?.reason ? <p className="mt-1 whitespace-pre-line">{lastDecision.reason}</p> : null}
    </Alert>
  );
}

export function ChecklistList({ title, doneLabel, items }: { title: string; doneLabel: string; items: string[] }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-success">{doneLabel}</p>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[15px]">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
