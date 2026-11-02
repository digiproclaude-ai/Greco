"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import {
  FormActions,
  FormStatus,
  SelectField,
  TextAreaField,
  TextField,
  fieldValue,
  type Option,
} from "@/components/forms/fields";
import { TermPicker, type PickerTerm } from "@/components/forms/term-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { formatMoney, minorToDecimalString, providerEarnings, splitDeposit } from "@/lib/money";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type RowAction = (formData: FormData) => Promise<void>;

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

function Rows({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  return <ul className="divide-y divide-line rounded-md border border-line">{children}</ul>;
}

// Basics ------------------------------------------------------------------------------------------

export type BasicsValues = {
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  primaryCategory: string | null;
  secondaryCategory: string | null;
  termIds: string[];
};

export function ListingBasicsForm({
  action,
  values,
  categories,
  terms,
  kindLabels,
  maxTerms,
}: {
  action: StateAction;
  values: BasicsValues;
  categories: Option[];
  terms: PickerTerm[];
  kindLabels: Record<string, string>;
  maxTerms: number;
}) {
  const t = useTranslations("listing.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextField name="title" label={t("title")} hint={t("titleHint")} state={state} defaultValue={values.title} maxLength={100} required />
      <TextField
        name="slug"
        label={t("slug")}
        hint={t("slugHint")}
        state={state}
        defaultValue={values.slug}
        maxLength={80}
        spellCheck={false}
        required
      />
      <TextAreaField
        name="summary"
        label={t("summary")}
        hint={t("summaryHint")}
        state={state}
        defaultValue={values.summary}
        maxLength={200}
        rows={2}
      />
      <TextAreaField
        name="description"
        label={t("description")}
        hint={t("descriptionHint")}
        state={state}
        defaultValue={values.description}
        maxLength={8000}
        rows={10}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="primaryCategory"
          label={t("primaryCategory")}
          state={state}
          defaultValue={values.primaryCategory}
          options={categories}
          placeholder={tForms("selectPlaceholder")}
        />
        <SelectField
          name="secondaryCategory"
          label={t("secondaryCategory")}
          state={state}
          defaultValue={values.secondaryCategory}
          options={categories}
          placeholder={tForms("none")}
          optional
        />
      </div>
      <TermPicker
        name="terms"
        label={t("terms")}
        hint={t("termsHint")}
        terms={terms}
        selected={values.termIds}
        max={maxTerms}
        kindLabels={kindLabels}
        error={state.fieldErrors?.terms}
      />
      <FormActions>
        <SubmitButton>{tForms("saveChanges")}</SubmitButton>
      </FormActions>
    </form>
  );
}

// Pricing ------------------------------------------------------------------------------------------

export type PricingValues = {
  pricingModel: string;
  currency: string;
  fixedPriceMinor: number | null;
  hourlyRateMinor: number | null;
  minHours: number | null;
  quoteFromMinor: number | null;
  baseDeliveryDays: number | null;
  revisionsIncluded: number | null;
  revisionPolicy: string | null;
};

export function ListingPricingForm({ action, values, currencies }: { action: StateAction; values: PricingValues; currencies: string[] }) {
  const t = useTranslations("listing");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  const [model, setModel] = useState(fieldValue(state, "pricingModel", values.pricingModel) || "packages");
  const decimal = (minor: number | null) => (minor === null ? null : minorToDecimalString(minor, values.currency));

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fields.pricingModel")}</legend>
        <RadioGroup name="pricingModel" value={model} onValueChange={setModel} className="sm:grid-cols-2">
          {(["packages", "fixed", "hourly", "quote"] as const).map((value) => (
            <RadioCard
              key={value}
              value={value}
              title={t(`pricingModels.${value}.title`)}
              description={t(`pricingModels.${value}.description`)}
            />
          ))}
        </RadioGroup>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <SelectField
          name="currency"
          label={t("fields.currency")}
          state={state}
          defaultValue={values.currency}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
        {model === "fixed" ? (
          <TextField
            name="fixedPrice"
            label={t("fields.fixedPrice")}
            state={state}
            defaultValue={decimal(values.fixedPriceMinor)}
            inputMode="decimal"
            required
          />
        ) : null}
        {model === "hourly" ? (
          <TextField
            name="hourlyRate"
            label={t("fields.hourlyRate")}
            state={state}
            defaultValue={decimal(values.hourlyRateMinor)}
            inputMode="decimal"
            required
          />
        ) : null}
        {model === "quote" ? (
          <TextField
            name="quoteFrom"
            label={t("fields.quoteFrom")}
            hint={t("fields.quoteFromHint")}
            state={state}
            defaultValue={decimal(values.quoteFromMinor)}
            inputMode="decimal"
            optional
          />
        ) : null}
      </div>
      {model !== "packages" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {model === "hourly" ? (
            <TextField
              name="minHours"
              label={t("fields.minHours")}
              state={state}
              defaultValue={values.minHours}
              type="number"
              min={1}
              max={1000}
              required
            />
          ) : null}
          <TextField
            name="baseDeliveryDays"
            label={t("fields.baseDeliveryDays")}
            state={state}
            defaultValue={values.baseDeliveryDays}
            type="number"
            min={1}
            max={365}
            optional={model === "quote"}
          />
        </div>
      ) : null}
      {model !== "packages" ? (
        <TextField
          name="revisionsIncluded"
          label={t("fields.revisionsIncluded")}
          state={state}
          defaultValue={values.revisionsIncluded}
          type="number"
          min={0}
          max={20}
          optional
        />
      ) : null}
      <TextAreaField
        name="revisionPolicy"
        label={t("fields.revisionPolicy")}
        hint={t("fields.revisionPolicyHint")}
        state={state}
        defaultValue={values.revisionPolicy}
        maxLength={1000}
        rows={3}
        optional
      />
      <FormActions>
        <SubmitButton>{tForms("saveChanges")}</SubmitButton>
      </FormActions>
    </form>
  );
}

// Packages -----------------------------------------------------------------------------------------

export type PackageValues = {
  id: string;
  tier: number;
  name: string;
  description: string | null;
  priceMinor: number;
  deliveryDays: number;
  revisions: number;
};

function PackageForm({
  tier,
  pkg,
  currency,
  saveAction,
  removeAction,
}: {
  tier: number;
  pkg: PackageValues | undefined;
  currency: string;
  saveAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing.fields");
  const [state, formAction] = useActionState(saveAction, idleState);
  return (
    <div className="grid gap-3 rounded-md border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{`${t("tier")} ${tier}`}</p>
        {pkg ? <RemoveRow action={removeAction} id={pkg.id} label={t("removePackage")} /> : null}
      </div>
      <form action={formAction} className="grid gap-4" noValidate>
        <FormStatus state={state} />
        <input type="hidden" name="tier" value={tier} />
        <TextField name="name" label={t("packageName")} state={state} defaultValue={pkg?.name} maxLength={40} required />
        <TextAreaField
          name="description"
          label={t("packageDescription")}
          state={state}
          defaultValue={pkg?.description}
          maxLength={500}
          rows={2}
          optional
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            name="price"
            label={`${t("price")} (${currency})`}
            state={state}
            defaultValue={pkg ? minorToDecimalString(pkg.priceMinor, currency) : null}
            inputMode="decimal"
            required
          />
          <TextField name="deliveryDays" label={t("deliveryDays")} state={state} defaultValue={pkg?.deliveryDays} type="number" min={1} max={365} required />
          <TextField name="revisions" label={t("revisions")} state={state} defaultValue={pkg?.revisions ?? 1} type="number" min={0} max={20} required />
        </div>
        <FormActions>
          <SubmitButton variant="secondary">{t("savePackage")}</SubmitButton>
        </FormActions>
      </form>
    </div>
  );
}

export function PackagesEditor({
  packages,
  currency,
  saveAction,
  removeAction,
}: {
  packages: PackageValues[];
  currency: string;
  saveAction: StateAction;
  removeAction: RowAction;
}) {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((tier) => (
        <PackageForm
          key={tier}
          tier={tier}
          pkg={packages.find((pkg) => pkg.tier === tier)}
          currency={currency}
          saveAction={saveAction}
          removeAction={removeAction}
        />
      ))}
    </div>
  );
}

// Payment terms ------------------------------------------------------------------------------------

export function ListingPaymentForm({
  action,
  values,
  depositOptions,
  commissionBps,
  exampleMinor,
  currency,
  rulesText,
}: {
  action: StateAction;
  values: { paymentModel: string; depositBps: number | null; balanceTrigger: string | null };
  depositOptions: number[];
  commissionBps: number;
  exampleMinor: number | null;
  currency: string;
  rulesText: string;
}) {
  const t = useTranslations("listing");
  const tForms = useTranslations("forms");
  const locale = useLocale();
  const [state, formAction] = useActionState(action, idleState);
  const [model, setModel] = useState(values.paymentModel);
  const [depositBps, setDepositBps] = useState<number>(values.depositBps ?? depositOptions[1] ?? depositOptions[0] ?? 3000);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = (bps: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <p className="text-sm text-ink-muted">{rulesText}</p>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fields.paymentModel")}</legend>
        <RadioGroup name="paymentModel" value={model} onValueChange={setModel} className="sm:grid-cols-2">
          {(["full", "deposit"] as const).map((value) => (
            <RadioCard
              key={value}
              value={value}
              title={t(`paymentModels.${value}.title`)}
              description={t(`paymentModels.${value}.description`)}
            />
          ))}
        </RadioGroup>
      </fieldset>
      {model === "deposit" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="field-depositBps">{t("fields.depositBps")}</Label>
            <select
              id="field-depositBps"
              name="depositBps"
              value={depositBps}
              onChange={(event) => setDepositBps(Number(event.target.value))}
              className="h-10 w-full rounded-md border border-control bg-surface px-3 text-[15px]"
            >
              {depositOptions.map((bps) => (
                <option key={bps} value={bps}>
                  {percent(bps)}
                </option>
              ))}
            </select>
          </div>
          <SelectField
            name="balanceTrigger"
            label={t("fields.balanceTrigger")}
            state={state}
            defaultValue={values.balanceTrigger ?? "before_final_delivery"}
            options={(["before_final_delivery", "on_milestone_acceptance"] as const).map((value) => ({
              value,
              label: t(`balanceTriggers.${value}`),
            }))}
          />
        </div>
      ) : null}
      <div className="grid gap-1 rounded-md bg-paper p-4 text-sm">
        {exampleMinor ? (
          <>
            {model === "deposit" ? (
              <p>
                {(() => {
                  const split = splitDeposit(exampleMinor, depositBps);
                  return t("payment.depositExample", {
                    total: money(exampleMinor),
                    deposit: money(split.deposit),
                    balance: money(split.balance),
                  });
                })()}
              </p>
            ) : null}
            <p>
              {(() => {
                const split = providerEarnings(exampleMinor, commissionBps);
                return t("payment.earningsExample", {
                  total: money(exampleMinor),
                  earnings: money(split.earnings),
                  commission: money(split.commission),
                  rate: percent(commissionBps),
                });
              })()}
            </p>
          </>
        ) : (
          <p>{t("payment.noPriceYet")}</p>
        )}
        <p className="text-ink-muted">{t("payment.noPayments")}</p>
      </div>
      <FormActions>
        <SubmitButton>{tForms("saveChanges")}</SubmitButton>
      </FormActions>
    </form>
  );
}

// Deliverables ------------------------------------------------------------------------------------

export function DeliverablesEditor({
  items,
  packages,
  addAction,
  removeAction,
}: {
  items: { id: string; title: string; packageId: string | null }[];
  packages: { id: string; tier: number; name: string }[];
  addAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(addAction, idleState);
  const packageName = (id: string | null) => packages.find((pkg) => pkg.id === id)?.name;
  return (
    <div className="grid gap-4">
      <Rows empty={t("empty")}>
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span>
              {item.title}
              {item.packageId ? <span className="text-sm text-ink-muted">{` · ${packageName(item.packageId) ?? ""}`}</span> : null}
            </span>
            <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.title}`} />
          </li>
        ))}
      </Rows>
      <form action={formAction} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <TextField name="title" label={t("deliverable")} state={state} maxLength={160} />
          <SelectField
            name="packageId"
            label={t("deliverablePackage")}
            state={state}
            options={packages.map((pkg) => ({ value: pkg.id, label: pkg.name }))}
            placeholder={t("allPackages")}
          />
          <SubmitButton variant="secondary">{t("addDeliverable")}</SubmitButton>
        </div>
      </form>
    </div>
  );
}

// Add-ons -------------------------------------------------------------------------------------------

export function AddonsEditor({
  items,
  currency,
  addAction,
  removeAction,
}: {
  items: { id: string; title: string; description: string | null; priceMinor: number; extraDays: number }[];
  currency: string;
  addAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing.fields");
  const tForms = useTranslations("forms");
  const locale = useLocale();
  const [state, formAction] = useActionState(addAction, idleState);
  return (
    <div className="grid gap-4">
      <Rows empty={t("empty")}>
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="grid">
              <span className="font-medium">{`${item.title} · ${formatMoney(item.priceMinor, currency, locale)}`}</span>
              {item.description ? <span className="text-sm text-ink-muted">{item.description}</span> : null}
            </span>
            <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.title}`} />
          </li>
        ))}
      </Rows>
      <form action={formAction} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="title" label={t("addonTitle")} state={state} maxLength={120} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="price" label={`${t("price")} (${currency})`} state={state} inputMode="decimal" />
            <TextField name="extraDays" label={t("extraDays")} state={state} type="number" min={0} max={180} optional />
          </div>
        </div>
        <TextField name="description" label={t("addonDescription")} state={state} maxLength={500} optional />
        <FormActions>
          <SubmitButton variant="secondary">{t("addAddon")}</SubmitButton>
        </FormActions>
      </form>
    </div>
  );
}

// Requirements --------------------------------------------------------------------------------------

export function RequirementsEditor({
  items,
  addAction,
  removeAction,
}: {
  items: { id: string; prompt: string; inputType: string; isRequired: boolean }[];
  addAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(addAction, idleState);
  const [type, setType] = useState("long_text");
  const types = (["long_text", "text", "url", "choice", "multi_choice"] as const).map((value) => ({
    value,
    label: t(`inputTypes.${value}`),
  }));
  return (
    <div className="grid gap-4">
      <Rows empty={t("fields.empty")}>
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="grid">
              <span className="font-medium">{item.prompt}</span>
              <span className="text-sm text-ink-muted">
                {t(`inputTypes.${item.inputType as "text"}`)}
                {item.isRequired ? ` · ${t("fields.isRequired")}` : ""}
              </span>
            </span>
            <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.prompt}`} />
          </li>
        ))}
      </Rows>
      <form action={formAction} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <TextField name="prompt" label={t("fields.prompt")} state={state} maxLength={300} />
        <div className="grid gap-1.5">
          <Label htmlFor="field-inputType">{t("fields.inputType")}</Label>
          <select
            id="field-inputType"
            name="inputType"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-10 w-full rounded-md border border-control bg-surface px-3 text-[15px]"
          >
            {types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {type === "choice" || type === "multi_choice" ? (
          <TextAreaField name="options" label={t("fields.options")} hint={t("fields.optionsHint")} state={state} rows={4} />
        ) : null}
        <div className="flex items-center gap-2">
          <Checkbox id="field-isRequired" name="isRequired" defaultChecked />
          <Label htmlFor="field-isRequired">{t("fields.isRequired")}</Label>
        </div>
        <FormActions>
          <SubmitButton variant="secondary">{t("fields.addRequirement")}</SubmitButton>
        </FormActions>
      </form>
    </div>
  );
}

// FAQs ----------------------------------------------------------------------------------------------

export function FaqsEditor({
  items,
  addAction,
  removeAction,
}: {
  items: { id: string; question: string; answer: string }[];
  addAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(addAction, idleState);
  return (
    <div className="grid gap-4">
      <Rows empty={t("empty")}>
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <span className="grid">
              <span className="font-medium">{item.question}</span>
              <span className="text-sm whitespace-pre-line text-ink-muted">{item.answer}</span>
            </span>
            <RemoveRow action={removeAction} id={item.id} label={`${tForms("remove")} ${item.question}`} />
          </li>
        ))}
      </Rows>
      <form action={formAction} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <TextField name="question" label={t("question")} state={state} maxLength={200} />
        <TextAreaField name="answer" label={t("answer")} state={state} maxLength={1500} rows={3} />
        <FormActions>
          <SubmitButton variant="secondary">{t("addFaq")}</SubmitButton>
        </FormActions>
      </form>
    </div>
  );
}

// Images --------------------------------------------------------------------------------------------

export function ListingImagesEditor({
  images,
  max,
  uploadAction,
  removeAction,
}: {
  images: { id: string; alt: string; url: string | null }[];
  max: number;
  uploadAction: StateAction;
  removeAction: RowAction;
}) {
  const t = useTranslations("listing.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(uploadAction, idleState);
  return (
    <div className="grid gap-5">
      {images.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-md border border-line">
              {image.url ? (
                <Image src={image.url} alt={image.alt} width={640} height={400} className="aspect-[16/10] w-full bg-paper object-cover" unoptimized />
              ) : null}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                  {index === 0 ? <Badge variant="accent">{t("cover")}</Badge> : null}
                  <span className="truncate">{image.alt}</span>
                </span>
                <RemoveRow action={removeAction} id={image.id} label={`${tForms("remove")} ${image.alt}`} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {images.length < max ? (
        <form action={formAction} className="grid gap-4" key={state.at} noValidate>
          <FormStatus state={state} />
          <div className="grid gap-1.5">
            <Label htmlFor="field-listing-image">{t("image")}</Label>
            <Input id="field-listing-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="py-1.5" />
          </div>
          <TextField name="alt" label={t("alt")} hint={t("altHint")} state={state} maxLength={200} required />
          <FormActions>
            <SubmitButton variant="secondary">{t("upload")}</SubmitButton>
          </FormActions>
        </form>
      ) : null}
    </div>
  );
}

// Lifecycle -----------------------------------------------------------------------------------------

export function SubmitListingForm({
  action,
  checklistLabels,
  disabled,
}: {
  action: () => Promise<ActionState>;
  checklistLabels: Record<string, string>;
  disabled: boolean;
}) {
  const t = useTranslations("listing.lifecycle");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormStatus state={state} checklistLabels={checklistLabels} />
      <div>
        <SubmitButton disabled={disabled}>{t("submit")}</SubmitButton>
      </div>
      <p className="text-sm text-ink-muted">{t("submitHint")}</p>
    </form>
  );
}

export function StatusButton({ action, value, label, variant = "secondary" }: { action: RowAction; value: string; label: string; variant?: "secondary" | "ghost" }) {
  return (
    <form action={action}>
      <input type="hidden" name="action" value={value} />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </form>
  );
}
