/**
 * Money helpers. Amounts are integer minor units plus an ISO 4217 currency (CLAUDE.md "Money").
 * No floating-point arithmetic: parsing and formatting work on decimal strings.
 */

/** Launch currencies (A-09). Exponents come from ISO 4217; never assume 2 elsewhere. */
export const CURRENCIES = ["USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const EXPONENTS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2 };

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency] ?? 2;
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Parse a user-typed amount ("49", "49.5", "1,250.00") into minor units. Thousands separators
 * are allowed only as commas or spaces; the decimal separator is a dot. Returns null when the
 * input is not a valid positive amount with at most the currency's number of decimals.
 */
export function parseMoneyToMinor(input: string, currency: string): number | null {
  const exponent = currencyExponent(currency);
  const cleaned = input.trim().replace(/[\s,]/g, "");
  const pattern = exponent === 0 ? /^\d{1,12}$/ : new RegExp(`^\\d{1,12}(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const minor = BigInt(whole) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Minor units to a plain decimal string ("4999" USD -> "49.99"). Used to prefill inputs. */
export function minorToDecimalString(minor: number | bigint, currency: string): string {
  const exponent = currencyExponent(currency);
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  if (exponent === 0) return `${negative ? "-" : ""}${abs}`;
  const base = 10n ** BigInt(exponent);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(exponent, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Localised money string. Passes a decimal string to Intl so no float is ever created. */
export function formatMoney(
  minor: number | bigint,
  currency: string,
  locale: string,
  options: { trimZeroFraction?: boolean } = {},
): string {
  const exponent = currencyExponent(currency);
  const decimal = minorToDecimalString(minor, currency);
  const trim = options.trimZeroFraction && BigInt(minor) % 10n ** BigInt(exponent) === 0n;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: trim ? 0 : exponent,
    maximumFractionDigits: exponent,
  });
  // ES2023 Intl.NumberFormat accepts exact decimal strings.
  return formatter.format(decimal as unknown as number);
}

/** round_half_up(amount × bps / 10000) on integers (PAYMENT_ARCHITECTURE.md §8.2). */
export function applyBps(amountMinor: number, bps: number): number {
  const product = BigInt(amountMinor) * BigInt(bps);
  const quotient = product / 10000n;
  const remainder = product % 10000n;
  return Number(remainder * 2n >= 10000n ? quotient + 1n : quotient);
}

/** Deposit and balance for an order subtotal; the two always add up exactly. */
export function splitDeposit(subtotalMinor: number, depositBps: number) {
  const deposit = applyBps(subtotalMinor, depositBps);
  return { deposit, balance: subtotalMinor - deposit };
}

/** What the expert receives from an amount after Greco's commission (D-14). */
export function providerEarnings(amountMinor: number, commissionBps: number) {
  const commission = applyBps(amountMinor, commissionBps);
  return { commission, earnings: amountMinor - commission };
}
