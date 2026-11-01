/** Split a URL path into its locale prefix (if any) and the path inside that locale. */
export function splitLocale(
  pathname: string,
  locales: readonly string[],
): { locale: string | null; path: string } {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { locale: null, path: pathname };
}
