/**
 * Payment collection port (PAYMENT_ARCHITECTURE.md §12). Amounts are integer minor units.
 * No implementation may report success without a verified provider event.
 */
export type PaymentCapabilities = {
  maxHoldDays: number;
  partialRefunds: boolean;
  multiInstallment: boolean;
  currencies: string[];
};

export type NormalizedPaymentEvent =
  | { type: "payment.succeeded" | "payment.failed" | "payment.requires_action"; paymentRef: string; eventId: string }
  | { type: "refund.succeeded" | "refund.failed"; refundRef: string; eventId: string }
  | { type: "dispute.opened" | "dispute.updated" | "dispute.closed"; disputeRef: string; eventId: string };

export interface PaymentProvider {
  readonly id: string;
  capabilities(country: string): PaymentCapabilities;
  createPayment(input: {
    installmentId: string;
    amountMinor: bigint;
    currency: string;
    applicationFeeMinor: bigint;
    payeeRef: string;
    idempotencyKey: string;
    returnUrl: string;
  }): Promise<{ paymentRef: string; redirectUrl: string }>;
  refund(input: {
    paymentRef: string;
    amountMinor: bigint;
    reverseApplicationFee: boolean;
    reverseTransfer: boolean;
    idempotencyKey: string;
  }): Promise<{ refundRef: string; status: "pending" | "succeeded" | "failed" }>;
  /** Verifies the signature; throws on anything it cannot authenticate. */
  parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent>;
}
