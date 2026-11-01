import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  // Optional until the features that need them are configured.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  JOBS_SECRET: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    JOBS_SECRET: process.env.JOBS_SECRET || undefined,
  });
  return cached;
}
