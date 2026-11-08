import "server-only";

import { processOutbox } from "./process-outbox";
import { runSavedSearchAlerts } from "./saved-search-alerts";
import { sendUnreadDigests } from "./send-digests";

/** Jobs that can be triggered by pg_cron (via pg_net) or Vercel Cron. */
export const jobs = {
  "process-outbox": () => processOutbox(),
  "send-digests": () => sendUnreadDigests(),
  "saved-search-alerts": () => runSavedSearchAlerts(),
} satisfies Record<string, () => Promise<unknown>>;

export type JobName = keyof typeof jobs;

export function isJobName(value: string): value is JobName {
  return Object.hasOwn(jobs, value);
}
