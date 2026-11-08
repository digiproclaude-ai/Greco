import { Download, FileText, Trash2 } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/files";
import { formatMoney, splitDeposit } from "@/lib/money";
import type { AttachmentInfo } from "@/server/modules/attachments/service";

type Translator = Awaited<ReturnType<typeof getTranslations<"projects">>>;

export type BudgetFields = {
  budget_kind: string;
  currency: string;
  budget_min_minor: number | null;
  budget_max_minor: number | null;
};

/** "Up to $5,000", "$2,000 – $5,000", "Budget open". */
export function budgetText(t: Translator, project: BudgetFields, locale: string): string {
  const money = (minor: number) => formatMoney(minor, project.currency, locale, { trimZeroFraction: true });
  const max = project.budget_max_minor;
  const min = project.budget_min_minor;
  switch (project.budget_kind) {
    case "fixed":
      return max ? t("budget.fixed", { amount: money(max) }) : t("budget.open");
    case "range":
      return min && max ? t("budget.range", { min: money(min), max: money(max) }) : t("budget.open");
    case "hourly":
      return max ? t("budget.hourly", { amount: money(max) }) : t("budget.open");
    default:
      return t("budget.open");
  }
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "accent"> = {
  open: "success",
  hired: "accent",
  removed: "warning",
  submitted: "accent",
  shortlisted: "success",
  accepted: "success",
  declined: "warning",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{label}</Badge>;
}

export type ProposalTermsData = {
  price_minor: number | null;
  currency: string;
  pricing_model: string;
  hours: number | null;
  estimated_days: number | null;
  revisions_included: number | null;
  payment_model: string;
  deposit_bps: number | null;
  balance_trigger: string | null;
};

/** Price, timeline, revisions and payment terms as a definition list. */
export async function ProposalTerms({ proposal }: { proposal: ProposalTermsData }) {
  const [t, locale] = await Promise.all([getTranslations("projects.proposal"), getLocale()]);
  const money = (minor: number) => formatMoney(minor, proposal.currency, locale);
  const price = proposal.price_minor;
  let payment = t("full");
  if (proposal.payment_model === "deposit" && price && proposal.deposit_bps && proposal.balance_trigger) {
    const split = splitDeposit(price, proposal.deposit_bps);
    payment = t("deposit", {
      deposit: money(split.deposit),
      balance: money(split.balance),
      trigger: t(`depositTriggers.${proposal.balance_trigger as "before_final_delivery"}`),
    });
  }
  const rows: [string, string][] = [
    [
      t("price"),
      price
        ? proposal.pricing_model === "hourly_block" && proposal.hours
          ? `${money(price)} · ${t("hourlyBlock", { hours: proposal.hours })}`
          : money(price)
        : "—",
    ],
    [t("timeline"), proposal.estimated_days ? t("days", { count: proposal.estimated_days }) : "—"],
    [t("revisions"), t("revisionsCount", { count: proposal.revisions_included ?? 0 })],
    [t("payment"), payment],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function MilestoneList({
  milestones,
  currency,
}: {
  milestones: { seq: number; title: string; description?: string | null; amount_minor: number; due_offset_days: number }[];
  currency: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("projects.proposal"), getLocale()]);
  if (milestones.length === 0) return null;
  return (
    <ol className="divide-y divide-line rounded-md border border-line">
      {milestones.map((m) => (
        <li key={m.seq} className="grid gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{`${m.seq}. ${m.title}`}</span>
            <span className="font-medium">{formatMoney(m.amount_minor, currency, locale)}</span>
          </div>
          {m.description ? <p className="text-sm whitespace-pre-line text-ink-muted">{m.description}</p> : null}
          <p className="text-sm text-ink-muted">{t("milestoneDue", { count: m.due_offset_days })}</p>
        </li>
      ))}
    </ol>
  );
}

/** Private files with their scan status. Downloads go through /api/files, which re-checks access. */
export async function AttachmentList({
  files,
  removeAction,
}: {
  files: AttachmentInfo[];
  removeAction?: (formData: FormData) => Promise<void>;
}) {
  const [t, locale] = await Promise.all([getTranslations("projects.attachments"), getLocale()]);
  if (files.length === 0) return <p className="text-sm text-ink-muted">{t("empty")}</p>;
  return (
    <ul className="divide-y divide-line rounded-md border border-line">
      {files.map((file) => {
        const downloadable = file.mine || file.scanStatus === "clean";
        const scanKey = (["pending", "clean", "infected", "error", "skipped"] as const).find((key) => key === file.scanStatus) ?? "pending";
        return (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              <span className="grid min-w-0">
                <span className="truncate font-medium">{file.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  {formatFileSize(file.size, locale)}
                  <Badge variant={file.scanStatus === "clean" ? "success" : file.scanStatus === "pending" ? "neutral" : "warning"}>
                    {t(`scan.${scanKey}`)}
                  </Badge>
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1">
              {downloadable && file.scanStatus !== "infected" ? (
                <Button asChild variant="ghost" size="sm">
                  {/* Plain link: the route handler answers with a redirect to a short-lived signed URL. */}
                  <a href={`/api/files/${file.id}`} aria-label={t("download", { name: file.name })}>
                    <Download aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <span className="text-sm text-ink-muted">{t("notReady")}</span>
              )}
              {removeAction ? (
                <form action={removeAction}>
                  <input type="hidden" name="id" value={file.id} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={t("remove", { name: file.name })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Posted 3 Nov 2026" style dates for project lists. */
export async function dateFormatter() {
  const format = await getFormatter();
  return (value: string | null | undefined) => (value ? format.dateTime(new Date(value), { dateStyle: "medium" }) : "");
}
