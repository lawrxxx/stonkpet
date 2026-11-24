"use client";
import { Icon } from "@/components/Icon";
import { useGo } from "@/components/nav";
import type { Plan } from "@/lib/plan";
import { nm, useStore } from "@/lib/store";
import { LISTED_COUNT, nameOf, ROBOT_TICKERS, TRADABLE_COUNT } from "@/lib/stocks";
import { useWallet } from "@/lib/wallet";

const WHY = [["facts", "Facts"], ["assume", "Assuming"], ["opinion", "My take"]] as const;
type Note = { title: string; body: string };
type Line = { text: string; source?: { url: string; title: string } };

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** Notes shown above the plate: research flags, or the offline plan's built-in ones. */
function notesFor(p: Plan, cap: number): Note[] {
  const n = Object.keys(p.w).length;
  if (p.research) return p.research.flags.map((f) => ({ title: f.title, body: f.body }));
  const out: Note[] = [{ title: "Basic plan, no research", body: "I couldn't do live research just now, so this plan comes from simple keyword matching and has no sources yet." }];
  if (p.robot) out.push({
    title: "No robot stocks I can buy yet",
    body: `Robot makers like ${ROBOT_TICKERS.slice(0, 2).map(nameOf).join(" and ")} are listed on Base, but none has a usable price yet, so I can't check them against your rules. ${TRADABLE_COUNT} of the ${LISTED_COUNT} stocks on Base have an official price feed, and a few more trade in active pools.`,
  });
  if (p.cash > 0.005) out.push({ title: `${Math.round(p.cash * 100)}% stays in USDC for now`, body: `Only ${n} stocks match what you asked for, and none can go over ${cap}%. I'd rather hold cash than break your rule.` });
  return out;
}

/** The three reasoning tabs. Facts always carry a source when they come from research. */
function linesFor(p: Plan, tab: "facts" | "assume" | "opinion"): Line[] {
  const r = p.research;
  if (r) {
    if (tab === "facts") return r.facts.map((f) => ({ text: f.text, source: { url: f.url, title: f.title } }));
    return (tab === "assume" ? r.assumptions : r.opinions).map((text) => ({ text }));
  }
  const lead = nameOf(p.lead);
  return {
    facts: [{ text: `All ${Object.keys(p.w).length} are live on Base right now, with a Chainlink price feed.` }],
    assume: [{ text: "You're in this for a year or more, not a week." }, { text: "You're okay with these moving together. Same theme, same mood swings." }],
    opinion: [{ text: `${lead} fits best, so it gets the biggest bite. Never over your max, though.` }, { text: `It's all one theme. When ${p.theme} has a bad week, so will I.` }],
  }[tab];
}

export default function Proposal() {
  const s = useStore();
  const go = useGo();
  const wallet = useWallet();
  const p = s.plan;
  if (!p) return <section className="scr" />;

  const r = p.research;
  const notes = notesFor(p, s.cap);
  const lines = linesFor(p, s.why);
  const excl = p.excl.map(nameOf).join(" and ");

  const approve = () => {
    if (wallet.connected) { s.approve(); go("home"); return; }
    useStore.setState({ next: "approve" });
    s.open("wallet");
  };

  return (
    <section className="scr" aria-label="Plan">
      <p className="t-small muted">The plan{r ? ` · ${r.theme}` : ""}</p>
      <h1 className="t-title mt-1">What {nm(s)} came up with</h1>

      {notes.length > 0 && (
        <div className="stack gap-2 mt-5">
          {notes.map((n) => <div className="note" key={n.title}><b>{n.title}</b>{n.body}</div>)}
        </div>
      )}

      <div className="list mt-4">
        {Object.keys(p.w).sort((a, b) => p.w[b] - p.w[a]).map((k) => (
          <div className="row blk" key={k}>
            <div className="between strong">
              <span className="row-x gap-2">{nameOf(k)}{r?.priceSource?.[k] === "dex" && <span className="tag tag-muted">DEX price</span>}</span>
              <span className="num">{Math.round(p.w[k] * 100)}%</span>
            </div>
            <div className="bar"><i style={{ width: p.w[k] * 100 + "%" }} /></div>
            {r?.reasons[k] && <p className="t-small muted mt-2">{r.reasons[k]}</p>}
          </div>
        ))}
        {p.cash > 0.005 && (
          <div className="row blk">
            <div className="between strong"><span>Stays in USDC</span><span className="num">{Math.round(p.cash * 100)}%</span></div>
            <div className="bar"><i className="cash" style={{ width: p.cash * 100 + "%" }} /></div>
          </div>
        )}
      </div>
      <p className="t-small muted mt-2">{p.excl.length ? `${excl}'s out, like you asked. ` : ""}Nothing over {s.cap}%.</p>

      <div className="seg mt-6" role="tablist" aria-label="Reasoning">
        {WHY.map(([k, l]) => <button key={k} role="tab" aria-selected={k === s.why} aria-controls="whyBody" onClick={() => s.set({ why: k })}>{l}</button>)}
      </div>
      <div id="whyBody" role="tabpanel" className="list mt-3">
        {lines.length === 0 && <div className="row blk"><p className="t-small muted">Nothing I could back up with a source this time.</p></div>}
        {lines.map((l) => (
          <div className="row blk" key={l.text}>
            <p className="t-small">{l.text}</p>
            {l.source && (
              <a className="src src-link" href={l.source.url} target="_blank" rel="noreferrer">
                {host(l.source.url)}<Icon name="external" size={12} />
              </a>
            )}
          </div>
        ))}
      </div>
      <p className="t-caption muted mt-3">
        {r
          ? `Researched ${new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} with Claude and web search. Every source above was checked against the search results. Weights are calculated, not guessed.`
          : "Sample data, no live research."}
      </p>

      <div className="grow" style={{ minHeight: 24 }} />
      <button className="btn" onClick={approve}>Looks good</button>
      <button className="link mt-1" onClick={() => go("brief")}>Change what I said</button>
    </section>
  );
}
