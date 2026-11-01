import type { AppLocale } from "../routing";

import en from "./en";

export type Messages = typeof en;

const loaders: Record<AppLocale, () => Promise<Messages>> = {
  en: async () => en,
};

export function loadMessages(locale: AppLocale): Promise<Messages> {
  return loaders[locale]();
}
