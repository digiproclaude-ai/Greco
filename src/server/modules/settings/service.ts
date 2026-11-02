import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createSupabaseAnonClient } from "@/server/db/supabase-server";

export const SETTINGS_TAG = "settings";

export type MarketplaceSettings = {
  commissionBps: number;
  minOrderMinor: Record<string, number>;
  depositAllowedBps: number[];
  depositMinOrderMinor: Record<string, number>;
  currencies: string[];
};

const DEFAULTS: MarketplaceSettings = {
  commissionBps: 1500,
  minOrderMinor: { USD: 2500, EUR: 2500 },
  depositAllowedBps: [2000, 3000, 4000, 5000],
  depositMinOrderMinor: { USD: 30000, EUR: 30000 },
  currencies: ["USD", "EUR"],
};

/** Public marketplace rules from platform_settings (D-14, A-05, A-09, A-18). */
export async function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabaseAnonClient()
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "payments.provider_commission_bps",
      "payments.min_order_minor",
      "payments.deposit_allowed_bps",
      "payments.deposit_min_order_minor",
      "listings.currencies",
    ]);
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const values = new Map(data.map((row) => [row.key, row.value]));
  const read = <T,>(key: string, fallback: T): T => (values.has(key) ? (values.get(key) as T) : fallback);
  return {
    commissionBps: Number(read("payments.provider_commission_bps", DEFAULTS.commissionBps)),
    minOrderMinor: read("payments.min_order_minor", DEFAULTS.minOrderMinor),
    depositAllowedBps: read("payments.deposit_allowed_bps", DEFAULTS.depositAllowedBps),
    depositMinOrderMinor: read("payments.deposit_min_order_minor", DEFAULTS.depositMinOrderMinor),
    currencies: read("listings.currencies", DEFAULTS.currencies),
  };
}

/** 1500 -> "15%" in the given locale. */
export function formatBps(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);
}
