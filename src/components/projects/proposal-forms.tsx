"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { FormField, SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, fieldValue } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { formatMoney, minorToDecimalString, parseMoneyToMinor, providerEarnings } from "@/lib/money";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type RowAction = (formData: FormData) => Promise<void>;

/** "Write a proposal": creates (or reopens) the expert's draft and redirects to it. */
export function StartProposalForm({ action, label }: { action: () => Promise<ActionState>; label: string }) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormStatus state={state} />
      <div>
        <SubmitButton>{label}</SubmitButton>
      </div>
    </form>
  );
}

export type ProposalValues = {
  proposedSolution: string | null;
  relevantExperience: string | null;
  questions: string | null;
  conditions: string | null;
  pricingModel: string;
  priceMinor: number | null;
  hours: number | null;
  estimatedDays: number | null;
  revisionsIncluded: number | null;
  paymentModel: string;
  depositBps: number | null;
  balanceTrigger: string | null;
};

export function ProposalForm({
  action,
  values,
  currency,
  depositOptions,
  commissionBps,
  rulesText,
}: {
  action: StateAction;
  values: ProposalValues;
  currency: string;
  depositOptions: number[];
  commissionBps: number;
  rulesText: string;
}) {
  const t = useTranslations("projects.proposalEditor");
  const tListing = useTranslations("listing");
  const tForms = useTranslations("forms");
  const locale = useLocale();
  const [state, formAction] = useActionState(action, idleState);
  const [pricing, setPricing] = useState(fieldValue(state, "pricingModel", values.pricingModel) || "fixed");
  const [payment, setPayment] = useState(values.paymentModel);
  const [price, setPrice] = useState(fieldValue(state, "price", values.priceMinor === null ? null : minorToDecimalString(values.priceMinor, currency)));
  const priceMinor = parseMoneyToMinor(price, currency);
  const percent = (bps: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);
  const f = (key: string) => t(`fields.${key}` as "fields.price", { currency });

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextAreaField
        name="proposedSolution"
        label={f("proposedSolution")}
        hint={f("proposedSolutionHint")}
        state={state}
        defaultValue={values.proposedSolution}
        maxLength={8000}
        rows={10}
      />
      <TextAreaField
        name="relevantExperience"
        label={f("relevantExperience")}
        state={state}
        defaultValue={values.relevantExperience}
        maxLength={3000}
        rows={4}
        optional
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextAreaField name="questions" label={f("questions")} state={state} defaultValue={values.questions} maxLength={2000} rows={4} optional />
        <TextAreaField
          name="conditions"
          label={f("conditions")}
          state={state}
          defaultValue={values.conditions}
          maxLength={2000}
          rows={4}
          optional
        />
      </div>

      <h3 className="border-t border-line pt-5 font-semibold">{t("sections.pricing")}</h3>
      <p className="-mt-3 text-sm text-ink-muted">{t("sections.pricingDescription")}</p>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{f("pricingModel")}</legend>
        <RadioGroup name="pricingModel" value={pricing} onValueChange={setPricing} className="sm:grid-cols-2">
          {(["fixed", "hourly_block"] as const).map((value) => (
            <RadioCard
              key={value}
              value={value}
              title={t(`fields.pricingModels.${value}.title`)}
              description={t(`fields.pricingModels.${value}.description`)}
            />
          ))}
        </RadioGroup>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="price" label={f("price")} error={state.fieldErrors?.price}>
          {(aria) => (
            <Input {...aria} name="price" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" required />
          )}
        </FormField>
        {pricing === "hourly_block" ? (
          <TextField name="hours" label={f("hours")} state={state} defaultValue={values.hours} inputMode="numeric" required />
        ) : null}
        <TextField name="estimatedDays" label={f("estimatedDays")} state={state} defaultValue={values.estimatedDays} inputMode="numeric" required />
        <TextField
          name="revisionsIncluded"
          label={f("revisionsIncluded")}
          state={state}
          defaultValue={values.revisionsIncluded}
          inputMode="numeric"
          optional
        />
      </div>
      <p className="text-sm text-ink-muted">{rulesText}</p>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{f("paymentModel")}</legend>
        <RadioGroup name="paymentModel" value={payment} onValueChange={setPayment} className="sm:grid-cols-2">
          {(["full", "deposit"] as const).map((value) => (
            <RadioCard
              key={value}
              value={value}
              title={tListing(`paymentModels.${value}.title`)}
              description={tListing(`paymentModels.${value}.description`)}
            />
          ))}
        </RadioGroup>
      </fieldset>
      {payment === "deposit" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="depositBps"
            label={f("depositBps")}
            state={state}
            defaultValue={String(values.depositBps ?? depositOptions[1] ?? depositOptions[0] ?? "")}
            options={depositOptions.map((bps) => ({ value: String(bps), label: percent(bps) }))}
          />
          <SelectField
            name="balanceTrigger"
            label={f("balanceTrigger")}
            state={state}
            defaultValue={values.balanceTrigger ?? "before_final_delivery"}
            options={(["before_final_delivery", "on_milestone_acceptance"] as const).map((value) => ({
              value,
              label: tListing(`balanceTriggers.${value}`),
            }))}
          />
        </div>
      ) : null}
      <div className="grid gap-1 rounded-md bg-paper p-4 text-sm">
        {priceMinor ? (
          <p>
            {(() => {
              const split = providerEarnings(priceMinor, commissionBps);
              const money = (minor: number) => formatMoney(minor, currency, locale);
              return t("earnings", {
                total: money(priceMinor),
                earnings: money(split.earnings),
                commission: money(split.commission),
                rate: percent(commissionBps),
              });
            })()}
          </p>
        ) : null}
        <p className="text-ink-muted">{t("noPayments")}</p>
      </div>
      <FormActions>
        <SubmitButton>{tForms("saveChanges")}</SubmitButton>
      </FormActions>
    </form>
  );
}

function RemoveRow({ action, id, label }: { action: RowAction; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" aria-label={label}>
        <Trash2 aria-hidden="true" />
      </Button>
    </form>
  );
}

export function MilestonesEditor({
  items,
  currency,
  priceMinor,
  addAction,
  removeAction,
  max,
}: {
  items: { id: string; seq: number; title: string; description: string | null; amountMinor: number; dueOffsetDays: number }[];
  currency: string;
  priceMinor: number | null;
  addAction: StateAction;
  removeAction: RowAction;
  max: number;
}) {
  const t = useTranslations("projects.proposalEditor");
  const tProposal = useTranslations("projects.proposal");
  const tForms = useTranslations("forms");
  const locale = useLocale();
  const [state, formAction] = useActionState(addAction, idleState);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0);
  const f = (key: string) => t(`fields.${key}` as "fields.milestoneAmount", { currency });
  return (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{f("empty")}</p>
      ) : (
        <ol className="divide-y divide-line rounded-md border border-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <span className="grid">
                <span className="font-medium">{`${item.seq}. ${item.title} · ${money(item.amountMinor)}`}</span>
                {item.description ? <span className="text-sm text-ink-muted">{item.description}</span> : null}
                <span className="text-sm text-ink-muted">{tProposal("milestoneDue", { count: item.dueOffsetDays })}</span>
              </span>
              <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.title}`} />
            </li>
          ))}
        </ol>
      )}
      {items.length > 0 && priceMinor ? (
        <p className={total === priceMinor ? "text-sm text-success" : "text-sm text-warning"}>
          {t("milestonesTotal", { total: money(total), price: money(priceMinor) })}
        </p>
      ) : null}
      {items.length < max ? (
        <form action={formAction} className="grid gap-4 rounded-md border border-dashed border-line p-4" key={state.at} noValidate>
          <FormStatus state={state} />
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem_8rem]">
            <TextField name="title" idPrefix="milestone" label={f("milestoneTitle")} state={state} maxLength={120} required />
            <TextField name="amount" idPrefix="milestone" label={f("milestoneAmount")} state={state} inputMode="decimal" required />
            <TextField name="dueOffsetDays" idPrefix="milestone" label={f("milestoneDue")} state={state} inputMode="numeric" required />
          </div>
          <TextAreaField name="description" idPrefix="milestone" label={f("milestoneDescription")} state={state} maxLength={1000} rows={2} optional />
          <FormActions>
            <SubmitButton variant="secondary">{f("addMilestone")}</SubmitButton>
          </FormActions>
        </form>
      ) : null}
    </div>
  );
}

export function ProposalDeliverablesEditor({
  items,
  addAction,
  removeAction,
}: {
  items: { id: string; title: string }[];
  addAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("projects.proposalEditor.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(addAction, idleState);
  return (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span>{item.title}</span>
              <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.title}`} />
            </li>
          ))}
        </ul>
      )}
      <form action={formAction} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <TextField name="title" idPrefix="deliverable" label={t("deliverable")} state={state} maxLength={160} />
          <SubmitButton variant="secondary">{t("addDeliverable")}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
