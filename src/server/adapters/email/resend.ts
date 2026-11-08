import "server-only";

import { z } from "zod";

import type { EmailMessage, EmailProvider } from "./types";

const responseSchema = z.object({ id: z.string().min(1) });

/** Resend over its HTTP API (no SDK). https://resend.com/docs/api-reference/emails/send-email */
export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: Object.entries(message.tags ?? {}).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_") })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // The body may echo the address; keep only the status.
      throw new Error(`resend responded ${response.status}`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("resend returned an unexpected response");
    return { providerMessageId: parsed.data.id };
  }
}
