import "server-only";

import { cacheLife } from "next/cache";

import { createSupabaseAnonClient } from "@/server/db/supabase-server";

type Purpose = "register" | "sell" | "buy";

async function countryCodes(purpose: Purpose): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const column = purpose === "register" ? "can_register" : purpose === "sell" ? "can_sell" : "can_buy";
  const { data, error } = await createSupabaseAnonClient().from("countries").select("code").eq(column, true);
  if (error) throw new Error(`Could not load countries: ${error.message}`);
  return data.map((row) => row.code);
}

/** Country options for a select, named in the UI language and sorted alphabetically. */
export async function countryOptions(locale: string, purpose: Purpose = "register") {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  return (await countryCodes(purpose))
    .map((code) => ({ value: code, label: names.of(code) ?? code }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
