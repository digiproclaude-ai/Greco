export type EmailMessage = {
  to: string;
  /** next-intl message keys are rendered before sending; adapters receive final text. */
  subject: string;
  html: string;
  text: string;
  tags?: Record<string, string>;
  idempotencyKey: string;
};

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}
