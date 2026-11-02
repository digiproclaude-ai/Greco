import "server-only";

import { getTranslations } from "next-intl/server";

import type { Term } from "./service";

/** Translated names for term kinds (Skills, Technologies, Industries…). */
export async function termKindLabels(): Promise<Record<string, string>> {
  const t = await getTranslations("expert.termKinds");
  return Object.fromEntries(
    (["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const).map((kind) => [kind, t(kind)]),
  );
}

export const WORK_TERM_KINDS = new Set(["skill", "technology", "tool", "framework", "model", "platform", "use_case"]);

export function workTerms(terms: Term[], keep: string[] = []) {
  return terms.filter((term) => WORK_TERM_KINDS.has(term.kind) || keep.includes(term.id));
}

export function industryOptions(terms: Term[]) {
  return terms.filter((term) => term.kind === "industry").map((term) => ({ value: term.id, label: term.name }));
}
