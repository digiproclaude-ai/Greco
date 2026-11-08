import "server-only";

import { createTranslator, hasLocale } from "next-intl";

import { loadMessages } from "@/i18n/messages";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPublicEnv } from "@/lib/env";

import { notificationHref, notificationText, type NotificationLike } from "./present";

export type RenderedEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function absoluteUrl(locale: AppLocale, path: string) {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return new URL(`${prefix}${path}`, getPublicEnv().NEXT_PUBLIC_APP_URL).toString();
}

async function translator(rawLocale: string | null | undefined) {
  const locale: AppLocale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const messages = await loadMessages(locale);
  return { locale, t: createTranslator({ locale, messages, namespace: "notifications" }) };
}

/** Plain, accessible layout: one heading, short text, one button. All values are escaped. */
function layout(opts: { greeting: string; lines: string[]; cta: string; href: string; footer: string }): { text: string; html: string } {
  const text = [opts.greeting, "", ...opts.lines, "", `${opts.cta}: ${opts.href}`, "", "—", opts.footer].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1b19">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e1da;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;font-weight:600;font-size:18px">Greco</p>
<p style="margin:0 0 12px">${escapeHtml(opts.greeting)}</p>
${opts.lines.map((line) => `<p style="margin:0 0 12px;white-space:pre-line">${escapeHtml(line)}</p>`).join("\n")}
<p style="margin:20px 0"><a href="${escapeHtml(opts.href)}" style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px">${escapeHtml(opts.cta)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#6b675f">${escapeHtml(opts.footer)}</p>
</div></body></html>`;
  return { text, html };
}

export async function renderNotificationEmail(input: NotificationLike & { name: string; locale: string | null }): Promise<RenderedEmail> {
  const { locale, t } = await translator(input.locale);
  const { title, reason } = notificationText(t, input);
  const settingsUrl = absoluteUrl(locale, "/dashboard/settings/notifications");
  const body = layout({
    greeting: t("email.greeting", { name: input.name }),
    lines: reason ? [title, reason] : [title],
    cta: t("email.open"),
    href: absoluteUrl(locale, notificationHref(input)),
    footer: t("email.footer", { url: settingsUrl }),
  });
  return { subject: title, ...body };
}

export async function renderDigestEmail(input: { name: string; locale: string | null; conversations: number }): Promise<RenderedEmail> {
  const { locale, t } = await translator(input.locale);
  const body = layout({
    greeting: t("email.greeting", { name: input.name }),
    lines: [t("email.digest.body", { count: input.conversations })],
    cta: t("email.open"),
    href: absoluteUrl(locale, "/dashboard/messages"),
    footer: t("email.footer", { url: absoluteUrl(locale, "/dashboard/settings/notifications") }),
  });
  return { subject: t("email.digest.subject"), ...body };
}
