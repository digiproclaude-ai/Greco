import "server-only";

import { z } from "zod";

import type { FileScanner } from "./types";

// Response of clamav-rest-api (POST /api/v1/scan, multipart field FILES).
const responseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    result: z.array(z.object({ name: z.string(), is_infected: z.boolean().nullable(), viruses: z.array(z.string()).default([]) })).min(1),
  }),
});

/** ClamAV through a clamav-rest-api service (CLAMAV_URL, e.g. http://clamav:3000). */
export class ClamAvRestScanner implements FileScanner {
  readonly id = "clamav-rest";

  constructor(private readonly baseUrl: string) {}

  async scan({ bytes, fileName }: { bytes: Uint8Array; fileName: string }) {
    const form = new FormData();
    form.append("FILES", new Blob([bytes as BlobPart]), fileName);
    const response = await fetch(new URL("/api/v1/scan", this.baseUrl), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return { verdict: "error" as const, detail: `scanner responded ${response.status}` };
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.success) return { verdict: "error" as const, detail: "unexpected scanner response" };
    const result = parsed.data.data.result[0]!;
    if (result.is_infected === null) return { verdict: "error" as const, detail: "scanner could not read the file" };
    return result.is_infected
      ? { verdict: "infected" as const, detail: result.viruses.join(", ").slice(0, 300) }
      : { verdict: "clean" as const };
  }
}
