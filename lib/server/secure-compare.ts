import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for secrets (avoids leaking length via early exit).
 * Uses SHA-256 digests so both sides are fixed length before timingSafeEqual.
 */
export function secureStringEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}
