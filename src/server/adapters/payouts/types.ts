export type PayeeStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
};

export interface PayoutProvider {
  readonly id: string;
  startPayeeOnboarding(input: { providerId: string; country: string; returnUrl: string }): Promise<{
    accountRef: string;
    onboardingUrl: string;
  }>;
  getPayeeStatus(accountRef: string): Promise<PayeeStatus>;
  release(input: {
    accountRef: string;
    amountMinor: bigint;
    currency: string;
    sourcePaymentRefs: string[];
    idempotencyKey: string;
  }): Promise<{ transferRef?: string; payoutRef?: string; status: "pending" | "paid" | "failed" }>;
}
