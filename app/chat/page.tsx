"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { chipPool, esc, reply } from "@/lib/mockBrain";
import { nm, useStore, type Msg } from "@/lib/store";

function Bubble({ m }: { m: Msg }) {
  const answer = useStore((s) => s.answer);
  if (m.from === "me") return <div className="bub me" dangerouslySetInnerHTML={{ __html: m.html }} />;
  if (m.card) {
    const c = m.card;
    return (
      <div className="bub pb card-bub">
        <p className="num t-heading" style={{ fontSize: 18 }}>{c.title}</p>
        <p className="t-small muted mt-1">{c.body}</p>
        {c.status === "pending" ? (
          <div className="grid-2 mt-4">
            <button className="btn sm" onClick={() => answer(m.id, true)}>{c.yes}</button>
            <button className="btn sm secondary" onClick={() => answer(m.id, false)}>Hold on</button>
          </div>
        ) : (
          <p className={"t-small row-x gap-1 mt-3 " + (c.status === "yes" ? "up" : "muted")}>
            {c.status === "yes" && <Icon name="check" size={16} stroke={2.6} />}
            {c.status === "yes" ? "You said yes" : "You said hold on"}
          </p>
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
    useStore.getState().push({ from: "me", html: esc(q) });
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
    <section className="scr" aria-label="Chat">
      <div className="thread" aria-live="polite">
        {s.msgs.map((m) => <Bubble key={m.id} m={m} />)}
        <div ref={end} style={{ scrollMarginBottom: 150 }} />
      </div>
      <div className="composer">
        <div className="hscroll" role="group" aria-label="Suggestions">
          {chips.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}
        </div>
        <form className="row-x gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (v) { ask(v); setText(""); } }}>
          <input className="field" aria-label={`Message ${nm(s)}`} placeholder={`Ask ${nm(s)} anything`} autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn send" aria-label="Send"><Icon name="send" size={22} stroke={2.4} /></button>
        </form>
      </div>
    </section>
  );
}
