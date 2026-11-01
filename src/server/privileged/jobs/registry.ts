import "server-only";

import { processOutbox } from "./process-outbox";

/** Jobs that can be triggered by pg_cron (via pg_net) or Vercel Cron. */
export const jobs = {
  "process-outbox": () => processOutbox(),
} satisfies Record<string, () => Promise<unknown>>;

export type JobName = keyof typeof jobs;

export function isJobName(value: string): value is JobName {
  return Object.hasOwn(jobs, value);
}
