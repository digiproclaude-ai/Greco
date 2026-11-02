import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  AddonsEditor,
  DeliverablesEditor,
  FaqsEditor,
  ListingBasicsForm,
  ListingImagesEditor,
  ListingPaymentForm,
  ListingPricingForm,
  PackagesEditor,
  RequirementsEditor,
  StatusButton,
  SubmitListingForm,
} from "@/components/expert/listing-forms";
import { DeleteButton } from "@/components/expert/portfolio-forms";
import { ChecklistList } from "@/components/expert/status-panel";
import { EditorSection } from "@/components/forms/fields";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { publicMediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import {
  addAddonAction,
  addDeliverableAction,
  addFaqAction,
  addRequirementAction,
  changeListingStatusAction,
  deleteListingAction,
  removeAddonAction,
  removeDeliverableAction,
  removeFaqAction,
  removeListingImageAction,
  removePackageAction,
  removeRequirementAction,
  saveBasicsAction,
  savePackageAction,
  savePaymentAction,
  savePricingAction,
  submitListingAction,
  uploadListingImageAction,
} from "@/server/modules/catalog/actions";
import { EDITABLE_STATUSES, LISTING_LIMITS } from "@/server/modules/catalog/schemas";
import { getListingEditor, type ListingEditorData } from "@/server/modules/catalog/service";
import { getMarketplaceSettings } from "@/server/modules/settings/service";
import { termKindLabels, workTerms } from "@/server/modules/taxonomy/labels";
import { categoryOptions, getActiveTerms, getCategories } from "@/server/modules/taxonomy/service";

const CHECKLIST_KEYS = ["title", "summary", "description", "category", "skills", "pricing", "min_order", "deposit", "deposit_min_order"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("listing.editor");
  return { title: t("title") };
}

export default function EditServicePage({ params }: PageProps<"/[locale]/dashboard/expert/services/[id]">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

function examplePrice(data: ListingEditorData): number | null {
  const l = data.listing;
  switch (l.pricing_model) {
    case "fixed":
      return l.fixed_price_minor;
    case "hourly":
      return l.hourly_rate_minor && l.min_hours ? l.hourly_rate_minor * l.min_hours : null;
    case "packages": {
      const prices = data.packages.filter((pkg) => pkg.is_active).map((pkg) => pkg.price_minor);
      return prices.length > 0 ? Math.min(...prices) : null;
    }
    default:
      return l.quote_from_minor;
  }
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("expert", `/dashboard/expert/services/${id}`);
  const session = await getSessionClaims();
  if (!session || !account.provider || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [t, tServices, locale] = await Promise.all([getTranslations("listing"), getTranslations("expert.services"), getLocale()]);
  const [data, categories, terms, kindLabels, settings] = await Promise.all([
    getListingEditor(session.supabase, account.provider.id, id),
    getCategories(locale),
    getActiveTerms(locale),
    termKindLabels(),
    getMarketplaceSettings(),
  ]);
  if (!data) notFound();
  const { listing } = data;

  const status = listing.status;
  const editable = (EDITABLE_STATUSES as readonly string[]).includes(status);
  const checklistLabels = Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, t(key === "title" ? "checklist.title_item" : `checklist.${key}`)]),
  );
  const missing = data.missing.map((key) => checklistLabels[key] ?? key);
  const options = categoryOptions(categories).map((option) => ({ value: option.id, label: option.label }));
  const currency = listing.currency;
  const money = (minor: number | undefined) => (minor ? formatMoney(minor, currency, locale, { trimZeroFraction: true }) : "—");
  const rulesText = t("payment.rules", {
    minOrder: money(settings.minOrderMinor[currency]),
    depositMin: money(settings.depositMinOrderMinor[currency]),
  });
  const bind = <A extends unknown[], R>(fn: (listingId: string, ...rest: A) => R) => fn.bind(null, listing.id) as (...rest: A) => R;
  const readOnlyKey = (["pending_review", "suspended", "archived"] as const).find((s) => s === status);
  const publicHref = `/experts/${account.provider.handle}/${listing.slug}`;

  const sections = [
    ["basics", t("sections.basics")],
    ["pricing", t("sections.pricing")],
    ...(listing.pricing_model === "packages" ? [["packages", t("sections.packages")]] : []),
    ["payment", t("sections.payment")],
    ["deliverables", t("sections.deliverables")],
    ["addons", t("sections.addons")],
    ["requirements", t("sections.requirements")],
    ["faqs", t("sections.faqs")],
    ["images", t("sections.images")],
  ];

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/expert/services" className="text-sm text-accent hover:underline">
          {t("editor.back")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="font-display text-3xl font-semibold">{listing.title}</h1>
            <div>
              <Badge variant={status === "published" ? "success" : "neutral"}>{tServices(`statuses.${status}`)}</Badge>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href={publicHref}>{status === "published" ? t("editor.viewPublic") : t("editor.preview")}</Link>
          </Button>
        </div>
      </div>

      <nav aria-label={t("editor.jumpTo")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {sections.map(([key, label]) => (
          <a key={key} href={`#${key}`} className="text-accent hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <EditorSection id="status" title={t("sections.status")}>
        {data.lastDecision?.action === "reject" && status === "rejected" && data.lastDecision.reason ? (
          <Alert variant="warning" title={t("editor.changesRequested")}>
            <p className="whitespace-pre-line">{data.lastDecision.reason}</p>
          </Alert>
        ) : null}
        {readOnlyKey ? <Alert>{t(`editor.readOnly.${readOnlyKey}`)}</Alert> : null}
        {status === "published" ? <Alert>{data.pendingReview ? t("editor.pendingEditNote") : t("editor.liveEditNote")}</Alert> : null}
        {status === "suspended" && data.lastDecision?.reason ? (
          <p className="text-sm whitespace-pre-line text-ink-muted">{data.lastDecision.reason}</p>
        ) : null}
        {status === "draft" || status === "rejected" ? (
          <>
            <ChecklistList title={t("checklist.title")} doneLabel={t("checklist.done")} items={missing} />
            <SubmitListingForm action={bind(submitListingAction)} checklistLabels={checklistLabels} disabled={missing.length > 0} />
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {status === "published" ? (
            <StatusButton action={bind(changeListingStatusAction)} value="pause" label={t("lifecycle.pause")} />
          ) : null}
          {status === "paused" ? (
            <StatusButton action={bind(changeListingStatusAction)} value="resume" label={t("lifecycle.resume")} />
          ) : null}
          {(["draft", "rejected", "published", "paused"] as string[]).includes(status) ? (
            <StatusButton action={bind(changeListingStatusAction)} value="archive" label={t("lifecycle.archive")} variant="ghost" />
          ) : null}
          {status === "archived" ? (
            <StatusButton action={bind(changeListingStatusAction)} value="restore" label={t("lifecycle.restore")} />
          ) : null}
          {status === "draft" && !listing.published_at ? (
            <DeleteButton action={bind(deleteListingAction)} label={t("lifecycle.delete")} confirm={t("lifecycle.deleteConfirm")} />
          ) : null}
        </div>
      </EditorSection>

      <fieldset disabled={!editable} className="grid min-w-0 gap-6 disabled:opacity-70">
        <EditorSection id="basics" title={t("sections.basics")} description={t("sections.basicsDescription")}>
          <ListingBasicsForm
            action={bind(saveBasicsAction)}
            values={{
              title: listing.title,
              slug: listing.slug,
              summary: listing.summary,
              description: listing.description,
              primaryCategory: listing.primary_category_id,
              secondaryCategory: data.secondaryCategoryId,
              termIds: data.termIds,
            }}
            categories={options}
            terms={workTerms(terms, data.termIds)}
            kindLabels={kindLabels}
            maxTerms={LISTING_LIMITS.terms}
          />
        </EditorSection>

        <EditorSection id="pricing" title={t("sections.pricing")} description={t("sections.pricingDescription")}>
          <ListingPricingForm
            action={bind(savePricingAction)}
            currencies={settings.currencies}
            values={{
              pricingModel: listing.pricing_model,
              currency: listing.currency,
              fixedPriceMinor: listing.fixed_price_minor,
              hourlyRateMinor: listing.hourly_rate_minor,
              minHours: listing.min_hours,
              quoteFromMinor: listing.quote_from_minor,
              baseDeliveryDays: listing.base_delivery_days,
              revisionsIncluded: listing.revisions_included,
              revisionPolicy: listing.revision_policy,
            }}
          />
        </EditorSection>

        {listing.pricing_model === "packages" ? (
          <EditorSection id="packages" title={t("sections.packages")} description={t("sections.packagesDescription")}>
            <PackagesEditor
              currency={currency}
              saveAction={bind(savePackageAction)}
              removeAction={bind(removePackageAction)}
              packages={data.packages.map((pkg) => ({
                id: pkg.id,
                tier: pkg.tier,
                name: pkg.name,
                description: pkg.description,
                priceMinor: pkg.price_minor,
                deliveryDays: pkg.delivery_days,
                revisions: pkg.revisions_included,
              }))}
            />
          </EditorSection>
        ) : null}

        <EditorSection id="payment" title={t("sections.payment")} description={t("sections.paymentDescription")}>
          <ListingPaymentForm
            action={bind(savePaymentAction)}
            values={{ paymentModel: listing.payment_model, depositBps: listing.deposit_bps, balanceTrigger: listing.balance_trigger }}
            depositOptions={settings.depositAllowedBps}
            commissionBps={settings.commissionBps}
            exampleMinor={examplePrice(data)}
            currency={currency}
            rulesText={rulesText}
          />
        </EditorSection>

        <EditorSection id="deliverables" title={t("sections.deliverables")} description={t("sections.deliverablesDescription")}>
          <DeliverablesEditor
            items={data.deliverables.map((d) => ({ id: d.id, title: d.title, packageId: d.package_id }))}
            packages={data.packages.map((pkg) => ({ id: pkg.id, tier: pkg.tier, name: pkg.name }))}
            addAction={bind(addDeliverableAction)}
            removeAction={bind(removeDeliverableAction)}
          />
        </EditorSection>

        <EditorSection id="addons" title={t("sections.addons")} description={t("sections.addonsDescription")}>
          <AddonsEditor
            currency={currency}
            items={data.addons.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              priceMinor: a.price_minor,
              extraDays: a.extra_delivery_days,
            }))}
            addAction={bind(addAddonAction)}
            removeAction={bind(removeAddonAction)}
          />
        </EditorSection>

        <EditorSection id="requirements" title={t("sections.requirements")} description={t("sections.requirementsDescription")}>
          <RequirementsEditor
            items={data.requirements.map((r) => ({ id: r.id, prompt: r.prompt, inputType: r.input_type, isRequired: r.is_required }))}
            addAction={bind(addRequirementAction)}
            removeAction={bind(removeRequirementAction)}
          />
        </EditorSection>

        <EditorSection id="faqs" title={t("sections.faqs")} description={t("sections.faqsDescription")}>
          <FaqsEditor
            items={data.faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))}
            addAction={bind(addFaqAction)}
            removeAction={bind(removeFaqAction)}
          />
        </EditorSection>

        <EditorSection id="images" title={t("sections.images")} description={t("sections.imagesDescription")}>
          <ListingImagesEditor
            images={data.media.map((m) => ({ id: m.id, alt: m.alt, url: publicMediaUrl(m.path) }))}
            max={LISTING_LIMITS.media}
            uploadAction={bind(uploadListingImageAction)}
            removeAction={bind(removeListingImageAction)}
          />
        </EditorSection>
      </fieldset>
    </div>
  );
}
