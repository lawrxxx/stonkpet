"use client";
import { useEffect, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { useCapabilities } from "wagmi";
import { DATA_SUFFIX, HAS_BUILDER_CODE } from "@/lib/builderCode";
import { addressUrl, CHAIN, short, TOKENS, txUrl } from "@/lib/chain";
import { money } from "@/lib/store";
import { useBalances, useSponsoredCalls, useWallet } from "@/lib/wallet";

/**
 * Wallet self-test (not linked from the app). Proves passkey sign-in, balances,
 * a gas-sponsored transaction through our paymaster proxy, and Builder Code attribution.
 */
export default function Check() {
  const w = useWallet();
  const b = useBalances(w.address);
  const caps = useCapabilities({ query: { enabled: w.connected } });
  const tx = useSponsoredCalls();
  const [health, setHealth] = useState<{ paymasterConfigured: boolean; builderCode: string | null } | null>(null);
  useEffect(() => { fetch("/api/paymaster").then((r) => r.json()).then(setHealth).catch(() => setHealth(null)); }, []);
  const pm = (caps.data as Record<number, { paymasterService?: { supported: boolean } }> | undefined)?.[CHAIN.id]?.paymasterService?.supported;

  const Row = ({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean | null }) => (
    <div className="row"><span className="grow">{k}</span><span className={ok === true ? "up" : ok === false ? "down" : "mut"} style={{ fontSize: 14, textAlign: "right" }}>{v}</span></div>
  );

  return (
    <section className="scr on" aria-label="Wallet check">
      <h1 style={{ fontSize: 26 }}>Wallet check</h1>
      <p className="mut sm" style={{ marginTop: 4 }}>Passkey, gas sponsorship and Builder Code, end to end on {CHAIN.name}.</p>
      <div className="list" style={{ marginTop: 16 }}>
        <Row k="Network" v={`${CHAIN.name} (${CHAIN.id})`} />
        <Row k="Paymaster on server" v={health ? (health.paymasterConfigured ? "configured" : "missing CDP_PAYMASTER_URL") : "…"} ok={health?.paymasterConfigured ?? null} />
        <Row k="Builder Code" v={HAS_BUILDER_CODE ? (health?.builderCode ?? "set") : "missing NEXT_PUBLIC_BUILDER_CODE"} ok={HAS_BUILDER_CODE} />
        <Row k="Signed in" v={w.address ? <a href={addressUrl(w.address)} target="_blank" rel="noreferrer">{short(w.address)}</a> : "no"} ok={w.connected} />
        <Row k="Wallet supports paymaster" v={pm === undefined ? "…" : pm ? "yes" : "no"} ok={pm ?? null} />
        <Row k="USDC" v={b.USDC === null ? "…" : money(b.USDC)} />
        <Row k="ETH" v={b.ETH === null ? "…" : `${b.ETH.toFixed(5)}${b.ETHusd !== null ? " · " + money(b.ETHusd) : ""}`} />
      </div>
      {!w.connected ? (
        <button className="btn" style={{ marginTop: 16 }} disabled={w.connecting} onClick={() => w.signIn().catch(() => {})}>{w.connecting ? "Waiting for passkey…" : "Sign in with passkey"}</button>
      ) : (<>
        <p className="mut sm" style={{ marginTop: 16 }}>Sends a gas-free 0 USDC transfer to yourself, tagged with the Builder Code. Your wallet needs no ETH.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={tx.pending}
          onClick={() => tx.sendCalls([{ to: TOKENS.USDC.address, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [w.address!, BigInt(0)] }) }]).catch(() => {})}>
          {tx.pending ? "Sending…" : "Send gas-free test transaction"}
        </button>
        {tx.txHash && <p className="up sm" style={{ marginTop: 10 }}>✓ Confirmed · <a href={txUrl(tx.txHash)} target="_blank" rel="noreferrer">view on Basescan</a></p>}
        {tx.error && <p className="down sm" role="alert" style={{ marginTop: 10, wordBreak: "break-word" }}>{tx.error.message.split("\n")[0]}</p>}
        <button className="link" style={{ marginTop: 6 }} onClick={w.signOut}>Sign out</button>
      </>)}
      <p className="src" style={{ marginTop: 14, wordBreak: "break-all" }}>Data suffix: {DATA_SUFFIX ?? "none"}</p>
    </section>
  );
}
