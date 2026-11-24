"use client";
import { useEffect, useRef, useState } from "react";
import { chipPool, esc, reply } from "@/lib/mockBrain";
import { nm, useStore, type Msg } from "@/lib/store";

function Bubble({ m }: { m: Msg }) {
  const answer = useStore((s) => s.answer);
  if (m.from === "me") return <div className="bub me" dangerouslySetInnerHTML={{ __html: m.html }} />;
  if (m.card) {
    const c = m.card;
    return (
      <div className="bub pb" style={{ maxWidth: "92%", padding: 18 }}>
        <p style={{ font: "600 18px Fredoka,system-ui,sans-serif" }}>{c.title}</p>
        <p className="mut sm" style={{ marginTop: 4 }}>{c.body}</p>
        {c.status === "pending" ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn s" onClick={() => answer(m.id, true)}>{c.yes}</button>
            <button className="btn s alt" style={{ background: "var(--bg)" }} onClick={() => answer(m.id, false)}>Hold on</button>
          </div>
        ) : (
          <p className={c.status === "yes" ? "up" : "mut"} style={{ marginTop: 12, fontSize: 14 }}>{c.status === "yes" ? "✓ You said yes" : "You said hold on"}</p>
        )}
      </div>
    );
  }
  return <div className="bub pb" dangerouslySetInnerHTML={{ __html: (m.tag ? `<span class="tag">${esc(m.tag)}</span><br>` : "") + m.html }} />;
}

export default function Chat() {
  const s = useStore();
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  const rotate = () => {
    const st = useStore.getState();
    const pool = chipPool(st);
    const ci = (st.ci + 3) % pool.length;
    const pick = [...(st.guess || []), ...pool.slice(ci), ...pool.slice(0, ci)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
    st.set({ ci, guess: null });
    setChips(pick);
  };

  useEffect(() => {
    if (useStore.getState().msgs.length === 0) useStore.getState().approve();
    rotate();
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [s.msgs.length]);

  const ask = (q: string) => {
    const st = useStore.getState();
    st.push({ from: "me", html: esc(q) });
    setTimeout(() => {
      const r = reply(q, useStore.getState());
      const now = useStore.getState();
      if (r.card) now.push({ from: "pet", html: "", card: { ...r.card, status: "pending" } });
      else now.push({ from: "pet", html: r.html, tag: r.tag });
      if (r.guess) now.set({ guess: r.guess });
      if (r.sheet) setTimeout(() => useStore.getState().open(r.sheet!), 500);
      rotate();
    }, 400);
  };

  return (
    <section className="scr on" aria-label="Chat">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, paddingTop: 8 }} aria-live="polite">
        {s.msgs.map((m) => <Bubble key={m.id} m={m} />)}
        <div ref={end} style={{ scrollMarginBottom: 150 }} />
      </div>
      <div style={{ position: "sticky", bottom: -30, margin: "0 -24px -30px", padding: "10px 24px 16px", background: "var(--bg)" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 0 10px" }} role="group" aria-label="Suggestions">
          {chips.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}
        </div>
        <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (v) { ask(v); setText(""); } }}>
          <input aria-label={`Message ${nm(s)}`} placeholder={`Ask ${nm(s)} anything`} autoComplete="off" value={text} onChange={(e) => setText(e.target.value)}
            style={{ height: 52, border: 0, borderRadius: 26, background: "var(--card)", font: "700 16px Nunito,system-ui,sans-serif", textAlign: "left", padding: "0 20px", boxShadow: "0 3px 0 var(--line)" }} />
          <button className="btn" aria-label="Send" style={{ width: 52, height: 52, borderRadius: 26, flex: "none", fontSize: 22 }}>↑</button>
        </form>
      </div>
    </section>
  );
}
