"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { TranslatedFieldError } from "@/components/auth/form-parts";
import { Input } from "@/components/ui/input";
import type { FieldError } from "@/server/modules/identity/schemas";

export type PickerTerm = { id: string; name: string; kind: string };

/**
 * Multi-select for taxonomy terms: a filter box, the chosen terms as removable chips and a
 * scrollable checkbox list. Works without JavaScript (plain checkboxes, no filter).
 */
export function TermPicker({
  name,
  label,
  hint,
  terms,
  selected,
  max,
  kindLabels,
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  terms: PickerTerm[];
  selected: string[];
  max: number;
  kindLabels: Record<string, string>;
  error?: FieldError;
}) {
  const t = useTranslations("forms.picker");
  const id = useId();
  const [chosen, setChosen] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(terms.map((term) => [term.id, term])), [terms]);
  const normalized = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const map = new Map<string, PickerTerm[]>();
    for (const term of terms) {
      const list = map.get(term.kind) ?? [];
      list.push(term);
      map.set(term.kind, list);
    }
    return [...map.entries()];
  }, [terms]);

  const toggle = (termId: string, on: boolean) =>
    setChosen((current) => (on ? (current.length >= max ? current : [...current, termId]) : current.filter((x) => x !== termId)));

  return (
    <fieldset className="grid gap-2" aria-describedby={`${id}-hint ${error ? `${id}-error` : ""}`.trim()}>
      <legend className="text-sm font-medium">{label}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      <p className="text-sm text-ink-muted" aria-live="polite">
        {t("count", { count: chosen.length, max })}
      </p>
      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("selected")}>
          {chosen.map((termId) => (
            <li key={termId}>
              <button
                type="button"
                onClick={() => toggle(termId, false)}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-tint px-2.5 py-1 text-sm text-accent hover:border-accent"
                aria-label={t("remove", { name: byId.get(termId)?.name ?? "" })}
              >
                {byId.get(termId)?.name}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("filter")}
        aria-label={t("filter")}
      />
      <div className="max-h-64 overflow-y-auto rounded-md border border-line p-3">
        {groups.map(([kind, list]) => {
          const anyVisible = list.some((term) => !normalized || term.name.toLowerCase().includes(normalized));
          return (
            <div key={kind} className="mb-3 last:mb-0" hidden={!anyVisible}>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">{kindLabels[kind] ?? kind}</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {list.map((term) => {
                  const checked = chosen.includes(term.id);
                  const matches = !normalized || term.name.toLowerCase().includes(normalized);
                  // Filtered-out items stay in the DOM (hidden) so chosen ones are still submitted.
                  return (
                    <li key={term.id} hidden={!matches}>
                      <label className="flex items-center gap-2 text-[15px]">
                        <input
                          type="checkbox"
                          name={name}
                          value={term.id}
                          checked={checked}
                          disabled={!checked && chosen.length >= max}
                          onChange={(event) => toggle(term.id, event.target.checked)}
                          className="size-4 accent-[var(--color-accent)]"
                        />
                        {term.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <TranslatedFieldError id={`${id}-error`} error={error} />
    </fieldset>
  );
}
