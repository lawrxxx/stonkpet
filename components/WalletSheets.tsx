"use client";
import { useEffect, useState } from "react";
import { addressUrl, CHAIN, FAUCETS, IS_TESTNET, short, TOKENS } from "@/lib/chain";
import { money, nm, useStore } from "@/lib/store";
import { useBalances, useWallet } from "@/lib/wallet";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { useGo } from "./nav";

const fmt = (v: number | null, d = 2) => (v === null ? "…" : v.toFixed(d));

/** Passkey sign-in. Opens the Base Account popup (Face ID / fingerprint). */
export function SignIn() {
  const s = useStore();
  const go = useGo();
  const w = useWallet();
  const [err, setErr] = useState<string | null>(null);

  // Once connected, carry on with whatever the user was doing.
  useEffect(() => {
    if (!w.connected) return;
    const next = useStore.getState().next;
    useStore.setState({ next: null });
    if (next === "approve") { useStore.getState().approve(); go("home"); }
    else if (next === "home") { useStore.getState().ensurePlan(); go("home"); }
    else useStore.getState().close();
  }, [w.connected, go]);

  return (<>
    <h2 id="sheetT">Give {nm(s)} a home</h2>
    <p className="t-small muted">Your stocks live in a wallet only you control. Sign in with a passkey (your face or fingerprint). No seed phrase, no app to install.</p>
    <div className="list mt-4">
      <div className="row"><span className="grow">Network</span><span className="strong">{CHAIN.name}</span></div>
      <div className="row"><span className="grow">Network fees</span><span className="up">Covered</span></div>
      <div className="row"><span className="grow">Wallet</span><span className="t-small muted">Base Account</span></div>
    </div>
    {IS_TESTNET && <div className="note mt-3"><b>Testnet</b>This build runs on Base Sepolia with test money. Nothing here is real yet.</div>}
    {err && <p className="t-small down mt-3" role="alert">{err}</p>}
    <button className="btn mt-4" disabled={w.connecting}
      onClick={async () => { setErr(null); try { await w.signIn(); } catch (e) { setErr((e as Error)?.message?.includes("reject") ? "No worries. Tap again when you're ready." : "That didn't work. Try again?"); } }}>
      {w.connecting ? "Waiting for your passkey…" : "Continue with passkey"}
    </button>
    {s.next === "approve" && (
      <button className="link mt-1" style={{ display: "flex", marginInline: "auto" }}
        onClick={() => { useStore.setState({ next: null }); useStore.getState().approve(); go("home"); }}>
        Look around with sample money first
      </button>
    )}
  </>);
}

/** Add money, with the real wallet address and balances. */
export function Deposit() {
  const s = useStore();
  const w = useWallet();
  const b = useBalances(w.address);
  if (!w.address) return null;
  return (<>
    <h2 id="sheetT">Add money</h2>
    <p className="t-small muted">Send crypto to your {nm(s)} wallet, then feed it.</p>
    <div className="list mt-4">
      <div className="row blk">
        <p className="t-small muted">Your wallet on {CHAIN.name}</p>
        <div className="between mt-1" style={{ alignItems: "center" }}>
          <span className="num t-heading">{short(w.address)}</span>
          <CopyButton text={w.address} />
        </div>
        <a className="src src-link" href={addressUrl(w.address)} target="_blank" rel="noreferrer">View on Basescan <Icon name="external" size={12} /></a>
      </div>
      <div className="row"><span className="grow">USDC</span><span className="strong num">{b.USDC === null ? "…" : money(b.USDC)}</span></div>
      <div className="row">
        <span className="grow">ETH</span>
        <span className="strong num">{fmt(b.ETH, 5)}{b.ETHusd !== null && <span className="t-small muted"> · {money(b.ETHusd)}</span>}</span>
      </div>
      <div className="row"><span className="grow">cbBTC</span>{TOKENS.cbBTC ? <span className="strong num">{fmt(b.cbBTC, 6)}</span> : <span className="t-small muted">Mainnet only</span>}</div>
    </div>
    <div className="note mt-3"><b>Only send on {CHAIN.name}</b>Sending on another network can lose your money.</div>
    {IS_TESTNET && (
      <div className="grid-2 mt-3">
        <a className="btn sm" href={FAUCETS.usdc} target="_blank" rel="noreferrer">Get test USDC</a>
        <a className="btn sm secondary" href={FAUCETS.eth} target="_blank" rel="noreferrer">Get test ETH</a>
      </div>
    )}
  </>);
}
