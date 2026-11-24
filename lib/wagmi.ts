import { createConfig, http } from "wagmi";
import { baseAccount } from "wagmi/connectors";
import { CHAIN, RPC_URL } from "./chain";

/** Base Account (passkey smart wallet) only. No seed phrases, no extension wallets. */
export function getConfig() {
  return createConfig({
    chains: [CHAIN],
    multiInjectedProviderDiscovery: false,
    connectors: [baseAccount({ appName: "stonkpet", appLogoUrl: "https://stonkpet.vercel.app/icon.png", preference: { telemetry: false } })],
    ssr: true,
    transports: { [CHAIN.id]: http(RPC_URL) } as Record<typeof CHAIN.id, ReturnType<typeof http>>,
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
