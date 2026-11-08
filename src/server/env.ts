import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  // Optional until the features that need them are configured.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  JOBS_SECRET: z.string().min(32).optional(),
  // Email (A-25): Resend through its HTTP API. Without both values emails are logged, not sent.
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  // File scanning: a ClamAV REST service. Without it uploads stay "pending" and only their
  // uploader can download them.
  CLAMAV_URL: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    JOBS_SECRET: process.env.JOBS_SECRET || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    CLAMAV_URL: process.env.CLAMAV_URL || undefined,
  });
  return cached;
}
