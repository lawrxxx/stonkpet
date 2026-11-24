import { Attribution } from "ox/erc8021";

/**
 * Base Builder Code (ERC-8021). Register the app on dashboard.base.org to get a
 * `bc_...` code. The suffix is attached to every transaction the app sends.
 * wagmi ignores a global dataSuffix for connected wallets, so it is passed per call
 * (see lib/wallet.ts).
 */
/** stonkpet's code from dashboard.base.org. Public by design; NEXT_PUBLIC_BUILDER_CODE can override it. */
export const DEFAULT_BUILDER_CODE = "bc_h8bwov26";
export const BUILDER_CODE = (process.env.NEXT_PUBLIC_BUILDER_CODE || DEFAULT_BUILDER_CODE).trim();
export const HAS_BUILDER_CODE = /^bc_[a-z0-9]+$/i.test(BUILDER_CODE);
export const DATA_SUFFIX = HAS_BUILDER_CODE ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) : undefined;

/** Did this calldata carry our Builder Code? Used on receipts. */
export function isAttributed(data: `0x${string}` | undefined): boolean {
  if (!data || !HAS_BUILDER_CODE) return false;
  try { return Attribution.fromData(data)?.codes?.includes(BUILDER_CODE) ?? false; } catch { return false; }
}
