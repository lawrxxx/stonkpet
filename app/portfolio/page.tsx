"use client";
import { Icon } from "@/components/Icon";
import { CHAIN, short } from "@/lib/chain";
import { clock, pct, priceOf } from "@/lib/prices";
import { held, nm, useStore } from "@/lib/store";
import { nameOf } from "@/lib/stocks";
import { useWallet } from "@/lib/wallet";
import { useRealPortfolio } from "@/lib/account";

function NavRow({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
  return (
    <button className="row" onClick={onClick}>
      <span className="grow">{label}</span>
      {value && <span className="t-small muted">{value}</span>}
      <span className="chev"><Icon name="chevron" size={18} /></span>
    </button>
  );
}

/** Live Chainlink price and today's move for one stock, or an honest "no price". */
function PriceTag({ ticker }: { ticker: string }) {
  const b = useStore((s) => s.board);
  const p = priceOf(b, ticker);
  if (!b) return <span className="muted">…</span>;
  if (!p || p.price === null) return <span className="muted">no live price</span>;
  const d = p.dayChangePct;
  return (
    <span className="muted num" title={p.source === "dex" ? "Unofficial price from Base exchange pools" : p.updatedAt ? `Chainlink, updated ${clock(p.updatedAt)}` : undefined}>
      ${p.price.toFixed(2)}{d !== null && <> · <span className={d < 0 ? "down" : "up"}>{pct(d)}</span></>}
      {p.source === "dex" && " · DEX price"}
      {p.status === "stale" && " · frozen"}
    </span>
  );
}

export default function Portfolio() {
  const s = useStore();
  const wallet = useWallet();
  const rp = useRealPortfolio();
  if (!s.plan) return <section className="scr" />;
  // Signed in with trading live: real onchain holdings. Otherwise the sample portfolio.
  const real = rp.signedIn && rp.data?.tradingLive ? rp.data : null;
  const total = real ? real.stocksUsd : s.total;
  const values: Record<string, number> = real
    ? Object.fromEntries(real.holdings.map((h) => [h.ticker, h.valueUsd ?? 0]))
    : Object.fromEntries(Object.entries(held(s)).map(([k, f]) => [k, f * s.total]));
  const tickers = Object.keys(values).sort((a, b) => values[b] - values[a]);
  const goal = Math.min(100, Math.round(total / 10));
  const autoOn = Object.values(s.auto).filter(Boolean).length;

  return (
    <section className="scr" aria-label="Portfolio">
      <p className="muted">Everything {nm(s)} holds</p>
      <p className="num t-total mt-1">${total.toFixed(2)}</p>
      <p className="t-caption muted mt-1">
        {real ? `In stocks, valued at live prices${real.walletUsdc !== null ? ` · $${real.walletUsdc.toFixed(2)} USDC ready to feed` : ""}` : "Sample holdings. Sign in to see your real ones."}
      </p>

      <div className="grid-2 mt-4">
        <button className="btn sm" onClick={() => s.open("deposit")}>Add money</button>
        <button className="btn sm secondary" onClick={() => s.open("cashout")}>Cash out</button>
      </div>

      <div className="mt-5">
        <div className="between t-small"><span className="muted">Goal: $1,000 by June</span><span className="strong num">{goal}%</span></div>
        <div className="bar" role="progressbar" aria-valuenow={goal} aria-valuemin={0} aria-valuemax={100} aria-label="Goal progress"><i style={{ width: goal + "%" }} /></div>
      </div>

      <div className="list mt-5">
        {real && tickers.length === 0 && (
          <div className="row blk"><p className="strong">Nothing yet</p><p className="t-small muted mt-1">Feed {nm(s)} to buy your first stocks.</p></div>
        )}
        {tickers.map((k) => {
          const v = total > 0 ? Math.round((values[k] / total) * 100) : 0, over = v > s.cap;
          return (
            <div className="row blk" key={k}>
              <div className="between strong"><span>{nameOf(k)}</span><span className="num">${values[k].toFixed(2)}</span></div>
              <div className="bar"><i className={over ? "over" : undefined} style={{ width: v + "%" }} /><span className="cap" style={{ left: s.cap + "%" }} /></div>
              <div className="between t-caption mt-1" style={{ fontSize: 13 }}>
                <span className={over ? "down" : "muted"}>{v}%{over ? " · over your max" : ""}</span>
                <PriceTag ticker={k} />
              </div>
            </div>
          );
        })}
        {!real && s.plan.cash > 0.005 && (
          <div className="row blk"><div className="between strong"><span>USDC</span><span className="num">${(s.total * s.plan.cash).toFixed(2)}</span></div></div>
        )}
      </div>
      <p className="t-caption muted mt-2">The grey line is your {s.cap}% max.</p>

      <div className="list mt-5">
        <NavRow label="Autopilot" value={`${autoOn} on`} onClick={() => s.open("auto")} />
        <NavRow label="What you asked for" onClick={() => s.open("mandate")} />
        <NavRow label={`What ${nm(s)}'s been up to`} onClick={() => s.open("activity")} />
      </div>

      <div className="list mt-4">
        {wallet.connected && wallet.address ? (<>
          <NavRow label="Your wallet" value={`${short(wallet.address)} · ${CHAIN.name}`} onClick={() => s.open("deposit")} />
          <button className="row" onClick={wallet.signOut}><span className="grow">Sign out</span></button>
        </>) : (
          <NavRow label="Sign in with a passkey" value="Using sample money" onClick={() => s.open("wallet")} />
        )}
      </div>

      <p className="foot">
        Not financial advice. For adults outside the US; Coinbase tokenized stocks are only available in eligible jurisdictions.
        <br />{real ? "Testnet: mock stocks at real prices" : "Testnet build"}
      </p>
    </section>
  );
}
