import "server-only";

import { getServerEnv } from "@/server/env";

import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailMessage, EmailProvider } from "./types";

/** True when an email provider is configured (otherwise emails are skipped and logged). */
export function emailConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function getEmailProvider(): EmailProvider | null {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
}
