import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashing first so lengths don't leak). */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
