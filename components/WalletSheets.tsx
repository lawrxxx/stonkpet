"use client";
import { useEffect, useState } from "react";
import { addressUrl, CHAIN, FAUCETS, IS_TESTNET, short, TOKENS } from "@/lib/chain";
import { money, nm, useStore } from "@/lib/store";
import { useBalances, useWallet } from "@/lib/wallet";
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
    <p className="mut sm">Your stocks live in a wallet only you control. Sign in with a passkey, your face or fingerprint. No seed phrase, no app to install.</p>
    <div className="list" style={{ marginTop: 14 }}>
      <div className="row"><span className="grow">Network</span><b style={{ fontWeight: 700 }}>{CHAIN.name}</b></div>
      <div className="row"><span className="grow">Network fees</span><span className="up">Covered</span></div>
      <div className="row"><span className="grow">Wallet</span><span className="mut sm">Base Account</span></div>
    </div>
    {IS_TESTNET && <div className="note" style={{ marginTop: 12 }}><b>Testnet</b>This build runs on Base Sepolia with test money. Nothing here is real yet.</div>}
    {err && <p className="down sm" role="alert" style={{ marginTop: 12 }}>{err}</p>}
    <button className="btn" style={{ marginTop: 16 }} disabled={w.connecting}
      onClick={async () => { setErr(null); try { await w.signIn(); } catch (e) { setErr((e as Error)?.message?.includes("reject") ? "No worries. Tap again when you're ready." : "That didn't work. Try again?"); } }}>
      {w.connecting ? "Waiting for your passkey…" : "Continue with passkey"}
    </button>
    {s.next === "approve" && (
      <button className="link" style={{ display: "block", margin: "6px auto 0" }}
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
    <p className="mut sm">Send crypto to your {nm(s)} wallet, then feed it.</p>
    <div className="list" style={{ marginTop: 14 }}>
      <div className="row blk">
        <p className="mut sm">Your wallet on {CHAIN.name}</p>
        <div className="sp" style={{ alignItems: "center", marginTop: 4 }}>
          <b style={{ font: "600 20px Fredoka,system-ui,sans-serif" }}>{short(w.address)}</b>
          <CopyAddr text={w.address} />
        </div>
        <a className="src" href={addressUrl(w.address)} target="_blank" rel="noreferrer">View on Basescan ↗</a>
      </div>
      <div className="row"><span className="grow">USDC</span><b style={{ fontWeight: 700 }}>{b.USDC === null ? "…" : money(b.USDC)}</b></div>
      <div className="row"><span className="grow">ETH</span><b style={{ fontWeight: 700 }}>{fmt(b.ETH, 5)}{b.ETHusd !== null ? <span className="mut sm"> · {money(b.ETHusd)}</span> : null}</b></div>
      <div className="row"><span className="grow">cbBTC</span>{TOKENS.cbBTC ? <b style={{ fontWeight: 700 }}>{fmt(b.cbBTC, 6)}</b> : <span className="mut sm">Mainnet only</span>}</div>
    </div>
    <div className="note" style={{ marginTop: 12 }}><b>Only send on {CHAIN.name}</b>Sending on another network can lose your money.</div>
    {IS_TESTNET && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <a className="btn s" href={FAUCETS.usdc} target="_blank" rel="noreferrer">Get test USDC</a>
        <a className="btn s alt" href={FAUCETS.eth} target="_blank" rel="noreferrer">Get test ETH</a>
      </div>
    )}
  </>);
}

function CopyAddr({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button className="chip" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch {} setDone(true); }}>{done ? "Copied" : "Copy"}</button>;
}
