import { BUILDER_CODE } from "@/lib/builderCode";
import { CHAIN } from "@/lib/chain";

/** Which integrations are configured on this deployment. Booleans only, never values. */
export async function GET() {
  const pm = process.env.CDP_PAYMASTER_URL;
  let pmNetwork: string | null = null;
  try { pmNetwork = pm ? new URL(pm).pathname.split("/").filter(Boolean)[2] ?? null : null; } catch { pmNetwork = "invalid"; }
  return Response.json(
    {
      chain: { id: CHAIN.id, name: CHAIN.name },
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      paymaster: !!pm,
      paymasterNetworkOk: pmNetwork === (CHAIN.id === 84532 ? "base-sepolia" : "base"),
      builderCode: BUILDER_CODE || null,
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      zeroEx: !!process.env.ZERO_EX_API_KEY,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
