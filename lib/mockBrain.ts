/**
 * The demo's keyword "brain", ported. Used in mock mode and as the fallback when
 * the live Claude agent (/api/chat, milestone 5) is unavailable.
 *
 * Output is a small HTML string. Every interpolated user or state string goes
 * through esc(); everything else is our own constant copy.
 */
import { held, money, nm, CHG, type Card, type SheetKey, type Store } from "./store";
import { clock, opensWhen, pct, priceOf } from "./prices";
import { ABOUT, findListedOnly, findNotListed, findStock, nameOf, ROBOT_TICKERS, TRADABLE_COUNT } from "./stocks";

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const cap1 = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const src = (s: string) => `<span class="src" style="display:block">Source: ${s}</span>`;
const tag = (s: string) => `<span class="tag">${s}</span>`;

export type Reply = { html: string; tag?: string; card?: Omit<Card, "status">; sheet?: SheetKey; guess?: string[] };

export function reply(text: string, s: Store): Reply {
  const t = (" " + text.toLowerCase().replace(/[’']/g, "'").replace(/[?!.,]/g, " ") + " ")
    .replace(/ u /g, " you ").replace(/ ur /g, " your ").replace(/ r /g, " are ").replace(/ hw /g, " how ")
    .replace(/ wat | wht /g, " what ").replace(/ pls | plz /g, " please ").replace(/\s+/g, " ");
  const p = s.plan!, h = held(s), k = findStock(t), total = s.total, inv = Object.keys(p.w);
  const listedOnly = findListedOnly(t), miss = findNotListed(t);
  const n = (t.match(/(\d+(?:\.\d+)?)/) || [])[1], num = n ? +n : null, lead = nameOf(p.lead);
  const NAMES = nameOf;

  if (/\bhelp\b(?! me)|what can you|options|menu/.test(t))
    return { html: `Loads. Just ask in normal words:<br>• "How am I doing?" or "any news?"<br>• "Feed $10" or "sell $5 of Meta"<br>• "Add Apple" or "drop Meta"<br>• "Change my max to 35%"<br>• "Pause trading"<br>• "What if the market crashes?"<br>• "Help me hit my goal"<br>Anything that moves money, I'll check with you first.` };
  if (/\b(resume|unpause|start trading|wake up)\b/.test(t)) { s.set({ paused: false }); s.addLog("Back to work", "You said resume."); return { html: `I'm back on it. I'll follow your rules like before.` }; }
  if (/\b(pause|stop trading|freeze|stop buying)\b/.test(t)) { s.set({ paused: true }); s.addLog("Paused trading", "You asked me to stop for now."); return { html: `Paused. I won't buy or sell anything until you say "resume". Your stocks stay right where they are.` }; }
  if (/(max|limit|cap)/.test(t) && num) {
    if (num < 10 || num > 60) return { html: `Let's keep it between 10% and 60%. Lower than that and I can't build a plan, higher and one stock could sink you.` };
    if (num === s.cap) return { html: `Your max is already ${num}%.` };
    return { html: "", card: { title: `Change your max to ${num}%?`, body: num > s.cap ? `More room for your top stocks, but bigger swings.` : `Spreads things out more. I might need to hold some USDC.`, yes: `Set ${num}%`, action: { type: "setMax", pct: num } } };
  }
  if (/(sell|cash out|withdraw)/.test(t) && /(everything|all of it|all my)/.test(t))
    return { html: `Sure. Cashing out needs your fingerprint, so I've opened it for you.`, tag: "Needs your fingerprint", sheet: "cashout" };
  if (/(sell|trim|take profit)/.test(t) && k) {
    if (!(k in p.w)) return { html: `You don't own any ${NAMES(k)}.` };
    const pos = total * h[k], amt = Math.min(num || pos * 0.25, pos);
    if (s.paused) return { html: `You paused me. Say "resume" first and I'll do it.` };
    return { html: "", card: { title: `Sell ${money(amt)} of ${NAMES(k)}?`, body: `That goes back to USDC. You'd still own ${money(pos - amt)} of it.`, yes: "Sell", action: { type: "sell", ticker: k, amount: amt } } };
  }
  if (/(feed|invest|put in|top up)/.test(t) && num && !k) {
    if (s.paused) return { html: `You paused me. Say "resume" first.` };
    return { html: "", card: { title: `Feed ${money(num)}?`, body: `From your USDC, split the way we planned.${num > s.ask ? ` That's over the $${s.ask} you said to check on, which is why I'm asking.` : ""}`, yes: `Feed ${money(num)}`, action: { type: "feed", amount: num } } };
  }
  if (/(buy more|more of|double down)/.test(t)) {
    const x = k || p.lead;
    if (!(x in p.w)) return { html: `${NAMES(x)} isn't in your plan. Want me to add it? Just say "add ${NAMES(x)}".` };
    const v = Math.round(h[x] * 100);
    return v >= s.cap
      ? { html: `${NAMES(x)}'s already at ${v}% and your max is ${s.cap}%. You set that rule, so I'm sticking to it. You can change it, just say "change my max to ${Math.min(60, s.cap + 5)}%".`, tag: "Nope" }
      : { html: "", card: { title: `Buy more ${NAMES(x)}?`, body: `It's at ${v}%. There's room for about ${s.cap - v}% more before your max.`, yes: `Buy ${money((total * (s.cap - v)) / 100)}`, action: { type: "buyMore", ticker: x } } };
  }
  if (/robot/.test(t))
    return { html: `Robot stocks like ${ROBOT_TICKERS.slice(0, 2).map(NAMES).join(" and ")} are listed on Base, but none has a live price yet, so I won't buy them. Tesla is building robots, if you want something close. I'll ping you the day one gets a price.`, tag: "Not yet" };
  if (/(add|include|want some|get me|buy)/.test(t) && listedOnly && !k)
    return { html: `${NAMES(listedOnly)} is listed on Base, but there's no live price for it yet, so I can't check it against your rules. Only ${TRADABLE_COUNT} stocks have one right now. I'll let you know when it does.`, tag: "Not available" };
  if (/(add|include|want some|get me|buy)/.test(t) && miss && !k)
    return { html: `${cap1(miss)} isn't on Base yet, so I can't buy it. I'll let you know if it gets listed.`, tag: "Not available" };
  if (/(add|include|want some|get me|buy)/.test(t) && k) {
    if (k in p.w) return { html: `You already own ${NAMES(k)}. It's ${Math.round(h[k] * 100)}% of everything.` };
    const was = p.excl.includes(k);
    return { html: "", card: { title: `Add ${NAMES(k)} at 10%?`, body: `${was ? "You told me to skip it earlier. This would undo that. " : ""}I'd take a little from each of your other stocks to make room.`, yes: "Add it", action: { type: "add", ticker: k } } };
  }
  if (/(remove|drop|skip|get rid|no more|sell all)/.test(t) && k) {
    if (!(k in p.w)) return { html: `You don't own any ${NAMES(k)}, so nothing to drop.` };
    if (Object.keys(p.w).length <= 2) return { html: `That would leave you with one stock. Too risky for me. Add something else first?` };
    return { html: "", card: { title: `Drop ${NAMES(k)}?`, body: `I'd sell it and spread the money across the rest. I won't buy it again unless you ask.`, yes: "Drop it", action: { type: "drop", ticker: k } } };
  }
  if (/why/.test(t) && k)
    return { html: `${ABOUT[k] ?? ""}${src("company reports")}<br>${tag("My take")}<br>${k in p.w ? `It's ${Math.round(h[k] * 100)}% of your stuff because it fits "${esc(p.theme)}".` : `It's not in your plan because it doesn't really fit "${esc(p.theme)}".`}`, tag: "Fact" };
  if (/why/.test(t))
    return { html: `They're all live on Base and fit what you asked for (${esc(p.theme)}).${src("Base Tokenized Stocks API")}<br>${tag("My take")}<br>${lead} fits best, so it leads.`, tag: "Fact" };
  if ((/(best|top|winner)/.test(t) || /(worst|loser|weakest)/.test(t)) && s.board) {
    const moved = Object.keys(p.w).filter((x) => priceOf(s.board, x)?.dayChangePct != null);
    const dc = (x: string) => priceOf(s.board, x)!.dayChangePct!;
    moved.sort((a, b) => dc(b) - dc(a));
    if (moved.length)
      return { html: `Best today: ${NAMES(moved[0])}, ${pct(dc(moved[0]))}.<br>Worst: ${NAMES(moved[moved.length - 1])}, ${pct(dc(moved[moved.length - 1]))}.<br>One bad day isn't a reason to sell. I'm watching it.${src("Chainlink price feeds on Base")}` };
  }
  if (/(best|top|winner)/.test(t) || /(worst|loser|weakest)/.test(t)) {
    const ks = Object.keys(p.w).sort((a, b) => (CHG[b] ?? 0) - (CHG[a] ?? 0)), b = ks[0], w = ks[ks.length - 1];
    const f = (x: string) => `${(CHG[x] ?? 0) > 0 ? "+" : ""}${CHG[x] ?? 0}%`;
    return { html: `Best: ${NAMES(b)}, ${f(b)} this month.<br>Worst: ${NAMES(w)}, ${f(w)}.<br>One bad month isn't a reason to sell. I'm watching it.` };
  }
  if (/(crash|risk|worst case|scared|safe|lose)/.test(t))
    return { html: `Tech stocks fell about a third in 2022, and they've had other big drops too.${src("Nasdaq history")}<br>${tag("Assuming")}<br>A plate like yours could drop 30% or more in a bad year.<br><br>${tag("My take")}<br>Only put in money you won't need for a few years. Want it calmer? Say "change my max to 25%".`, tag: "Fact" };
  if (/(goal|1,?000|target|on track)/.test(t)) {
    const need = 1000 - total, wk = Math.ceil(need / 27);
    return { html: "", card: { title: `Feed $${wk} every Friday?`, body: `You need about $${Math.round(need)} more by June. That's roughly $${wk} a week, even if the market goes nowhere.`, yes: `Set $${wk}/week`, action: { type: "weekly", amount: wk } } };
  }
  if (k && /(how much|how many|worth|value|own|have|holding|my )/.test(t) && !/(buy|sell|add|drop|why)/.test(t))
    return k in p.w
      ? { html: `You've got ${money(total * h[k])} of ${NAMES(k)}. That's ${Math.round(h[k] * 100)}% of everything, and it's ${(CHG[k] ?? 0) > 0 ? "up" : "down"} ${Math.abs(CHG[k] ?? 0)}% this month.` }
      : { html: `You don't own any ${NAMES(k)} right now. Want some? Say "add ${NAMES(k)}".` };
  if (/(cash out|cashout|withdraw|take (my )?money out)/.test(t)) return { html: `Sure. Cashing out needs your fingerprint, so I've opened it for you.`, sheet: "cashout" };
  if (/(add money|deposit|fund my|send money|top up my wallet|receive)/.test(t)) return { html: `Here's your wallet address. Send USDC, ETH or cbBTC on Base, then feed me.`, sheet: "deposit" };
  if (/(usdc|cash|wallet|spare|available)/.test(t))
    return { html: `You have ${money(s.wallet.USDC)} of USDC in your wallet, ready to feed me.${p.cash > 0.005 ? ` Another ${money(total * p.cash)} is parked inside your plan because of your max.` : ""}` };
  if (/(how much|balance|worth|total|my money|portfolio|plate|stash|what do i (have|own)|what'?s in|holdings|what am i holding|net worth|value)/.test(t))
    return { html: `You've got <b>${money(total)}</b> in total, up 8% this month.<br>` + [...inv].sort((a, b) => h[b] - h[a]).map((x) => `• ${NAMES(x)}: ${money(total * h[x])}`).join("<br>") + (p.cash > 0.005 ? `<br>• USDC: ${money(total * p.cash)}` : "") + `<br><br>Plus ${money(s.wallet.USDC)} of USDC in your wallet, ready to feed me.` };
  if (/(my rules|rules|settings|my max|my limit)/.test(t))
    return { html: `Your rules:<br>• Nothing over ${s.cap}% in one company<br>• I check with you above $${s.ask}<br>• Never buy: ${p.excl.length ? p.excl.map(NAMES).join(", ") : "nothing set"}<br>• Trading: ${s.paused ? "paused" : "on"}<br><br>Want to change one? Just tell me, like "change my max to 35%".` };
  if (/(plan|diet|strategy|invested in|what are you buying|theme)/.test(t))
    return { html: `You asked for "${esc(p.brief.replace(/[.!\s]+$/, ""))}", so I eat ${inv.map(NAMES).join(", ")}, with ${NAMES(p.lead)} getting the biggest bite.` };
  if (/(level|streak|grow|xp)/.test(t)) return { html: `I'm level 3. You've fed me 4 weeks in a row. Two more weeks and I grow another leaf.` };
  if (/(how are you|you ok|you good|feeling|mood)/.test(t))
    return { html: s.wx === "rain" ? `Bit gloomy, honestly. Rough day in the market. But we're still up for the month, so I'm not panicking.` : s.wx === "night" ? `Sleepy. Market's closed. Ask me anything though.` : `Pretty great! The sun's out and we're up 8% this month.` };
  if (/(who are you|your name|what are you)/.test(t)) return { html: `I'm ${esc(nm(s))}, your pet. I research stocks, buy what fits your plan, and always ask before anything big.` };
  if (/(price|how much is|cost of)/.test(t) && k) {
    const q = priceOf(s.board, k);
    if (!q || q.price === null) return { html: `I can't get a live price for ${NAMES(k)} right now, and I won't guess.` };
    const when = q.updatedAt ? clock(q.updatedAt) : "";
    const note = q.status === "closed" ? " That's the last close, since the market's shut." : q.status === "stale" ? " Heads up, the feed looks frozen, so I wouldn't trade on it." : "";
    return { html: `One ${NAMES(k)} token is $${q.price.toFixed(2)}${q.dayChangePct !== null ? `, ${pct(q.dayChangePct)} today` : ""}.${note}${src(`Chainlink price feed on Base, ${when}`)}`, tag: "Fact" };
  }
  if (/(how am i|how are we|doing|performance|up or down|status|how'?s it going|gains|profit|made any money|make money|made money|making money|earn|returns|winning|losing)/.test(t))
    return { html: `We're up 8% this month. You're a quarter of the way to $1,000.${s.paused ? " Trading is paused, by the way." : ""}` };
  if (/(news|happening|today|update|morning)/.test(t)) {
    const moved = (s.board?.prices ?? []).filter((x) => x.dayChangePct !== null).sort((a, b) => Math.abs(b.dayChangePct!) - Math.abs(a.dayChangePct!));
    if (!moved.length) return { html: `I can't reach live prices right now, so no update from me. I'd rather say nothing than guess.`, tag: "Today" };
    return { html: `Biggest mover on Base ${s.board!.market.open ? "today" : "last session"}: ${NAMES(moved[0].ticker)}, ${pct(moved[0].dayChangePct!)}. Nothing you need to do.${src("Chainlink price feeds on Base")}<br>I don't read news headlines yet.`, tag: "Today" };
  }
  if (/(what is|what's|whats|explain|eli5|simple)/.test(t) && /(stock|token|share|base)/.test(t))
    return { html: `A stock is a tiny piece of a company. If the company does well, your piece is worth more.<br><br>Here, each stock is a token on Base, backed by a real share held by a regulated company. You own it like any other token.` };
  if (/(fee|cost|charge)/.test(t)) return { html: `Network fees are covered. If you pay in ETH or cbBTC, the swap can cost a little in price difference. I show you before you confirm.` };
  if (/(sleep|night|closed|weekend|market open)/.test(t)) {
    const now = s.board ? (s.board.market.open ? " Right now it's open." : ` It opens ${opensWhen(s.board)}.`) : "";
    return { html: `Stock markets close at night and on weekends. Prices freeze, so I don't trade then. Anything you feed waits till the open.${now}` };
  }
  if (/\b(hi|hello|hey|sup|yo)\b/.test(t))
    return { html: `Hey! ${s.wx === "rain" ? "Bit of a gloomy day, but I'm holding steady." : s.wx === "night" ? "*yawn* Market's closed, but I'm here." : "Feeling good today."} What's up?` };
  if (/thank/.test(t)) return { html: `Anytime.` };

  const EX = ["How much do I have?", "How am I doing?", "What are my rules?", "Feed $10", "Add Apple", "Sell $10 of " + lead, "What if the market crashes?", "Help me hit my goal", "Any news?", "What is a stock?", "Pause trading"];
  const words = t.split(" ").filter((x) => x.length > 2), score = (q: string) => words.filter((x) => q.toLowerCase().includes(x)).length;
  const guess = EX.map((q) => [q, score(q)] as const).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
  return { html: `Not sure I got that. Did you mean one of these?`, guess };
}

/** Suggestion chips, rotated like the demo. */
export function chipPool(s: Store): string[] {
  const p = s.plan!, lead = nameOf(p.lead), other = Object.keys(p.w).find((k) => k !== p.lead);
  const out = ["AAPL", "AMZN", "TSLA", "MSFT", "GOOGL"].find((k) => !(k in p.w) && !p.excl.includes(k));
  return ["How much do I have?", "How am I doing?", `Buy more ${lead}`, out ? `Add ${nameOf(out)}` : "Add Netflix", `Sell $10 of ${lead}`, other ? `Drop ${nameOf(other)}` : "Any news?", `Change my max to ${s.cap === 35 ? 30 : 35}%`, "Feed $10", "What if the market crashes?", "Help me hit my goal", s.paused ? "Resume" : "Pause trading", "Best and worst?", "What is a stock?", "Any news?", "What can you do?"];
}

