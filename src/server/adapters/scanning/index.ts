import "server-only";

import { getServerEnv } from "@/server/env";

import { ClamAvRestScanner } from "./clamav-rest";
import type { FileScanner } from "./types";

export type { FileScanner, ScanVerdict } from "./types";

export function getFileScanner(): FileScanner | null {
  const url = getServerEnv().CLAMAV_URL;
  return url ? new ClamAvRestScanner(url) : null;
}
