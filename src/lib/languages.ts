/** Languages experts can list (ISO 639-1). Names come from Intl.DisplayNames in the UI locale. */
export const LANGUAGE_CODES = [
  "af", "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es", "et", "fa", "fi", "fil", "fr", "ga", "he",
  "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl",
  "sr", "sv", "sw", "ta", "th", "tr", "uk", "ur", "vi", "zh",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryName(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function timeZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}
