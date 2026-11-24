import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cashOf, fit, leadOf, type Weights } from "@/lib/plan";
import { dexTradable, DEX_RULES, type DexStock } from "./dexPrices";
import { listStocks, type LiveStock } from "./stocksApi";

/**
 * Brief → sourced proposal.
 *
 *  1. Parse (structured output, no web): themes, picks from the stocks that are
 *     actually tradable on Base, exclusions, and anything asked for that isn't
 *     available, with the closest alternative.
 *  2. Research (web search + a strict submit tool): recent, citable facts per pick,
 *     plus assumptions and opinion. Every fact's URL is checked against the URLs the
 *     search actually returned; anything else is dropped.
 *  3. Weights come from fit() in code, never from the model.
 *
 * Structured outputs can't be combined with citations, so step 2 returns its
 * result through a strict tool instead of output_config.format.
 */
const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

const VOICE = `You are the voice of a small green pet in an investing app. Warm, casual, a bit playful, like a friend texting. Short sentences. Plain text: no markdown, no bullet symbols, no emoji. Use contractions. Never sound like a bank. Never hype.`;

export type ResearchInput = {
  brief: string;
  personality: "calm" | "balanced" | "spicy";
  maxPct: number;
  askAboveUsd: number;
  exclusions: string[]; // tickers
};

export type Flag = { kind: "unavailable" | "cash" | "excluded" | "dex"; title: string; body: string };
export type Fact = { ticker: string; text: string; url: string; title: string };
export type Proposal = {
  brief: string;
  theme: string;
  weights: Weights;
  cash: number;
  lead: string;
  excluded: string[];
  flags: Flag[];
  facts: Fact[];
  assumptions: string[];
  opinions: string[];
  reasons: Record<string, string>;
  /** Where each holding's price comes from: official Chainlink feed, or Base DEX pools. */
  priceSource: Record<string, "chainlink" | "dex">;
  catalog: { source: "live" | "snapshot"; listed: number; official: number; dex: number };
  droppedFacts: number;
  model: string;
  createdAt: string;
};

// ---------- step 1: parse ----------

const ParseSchema = z.object({
  theme: z.string().describe("2-4 word label for what they asked for, e.g. 'AI and robots'"),
  picks: z.array(z.object({
    ticker: z.string().describe("Must be from one of the two TRADABLE lists"),
    fit: z.number().describe("How well it matches the brief, 1 (loose) to 10 (exactly what they asked for)"),
    reason: z.string().describe("One short sentence in the pet's voice: why it fits"),
  })),
  excluded: z.array(z.string()).describe("Tickers the user said to skip, from either list"),
  unavailable: z.array(z.object({
    asked: z.string().describe("What they asked for that you can't buy, in their words, e.g. 'robots' or 'Netflix'"),
    listed_tickers: z.array(z.string()).describe("Matching tickers from LISTED WITHOUT A USABLE PRICE, if any"),
    closest: z.string().nullable().describe("Closest TRADABLE ticker, or null"),
    title: z.string().describe("Short headline in the pet's voice, e.g. 'No robot stocks I can buy yet'"),
    note: z.string().describe("1-2 sentences in the pet's voice: what's missing, why, and the closest alternative if any"),
  })),
});
type Parsed = z.infer<typeof ParseSchema>;

function catalogText(stocks: LiveStock[], dex: DexStock[]) {
  const dexSet = new Set(dex.map((s) => s.ticker));
  const official = stocks.filter((s) => s.navFeed).map((s) => `${s.ticker}: ${s.name}`).join("\n");
  const dexList = dex.map((s) => `${s.ticker}: ${s.name}`).join("\n");
  const unpriced = stocks.filter((s) => !s.navFeed && !dexSet.has(s.ticker)).map((s) => `${s.ticker}: ${s.name}`).join("\n");
  return `TRADABLE, OFFICIAL PRICE (on Base, with a Chainlink price feed):\n${official}\n\nTRADABLE, DEX PRICE ONLY (on Base, priced from active exchange pools, no official feed; each trade is capped and needs the user's OK):\n${dexList}\n\nLISTED WITHOUT A USABLE PRICE (on Base, but no feed and no active pool, so they can't be bought here):\n${unpriced}`;
}

async function parseBrief(client: Anthropic, input: ResearchInput, stocks: LiveStock[], dex: DexStock[]): Promise<Parsed> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ParseSchema) },
    system: [
      { type: "text", text: `${VOICE}\n\nYou turn a plain-language investing brief into picks from a fixed list of tokenized US stocks on Base.\n\nRules:\n- Pick only from the two TRADABLE lists. Never invent tickers.\n- Pick stocks that genuinely match the brief. Fewer, better matches beat padding the list. Usually 3 to 6.\n- DEX-price stocks are fine when they're what the user asked for. When two picks fit equally well, prefer the one with an official price.\n- If they ask for something that only exists in LISTED WITHOUT A USABLE PRICE, or isn't on Base at all, add it to "unavailable" and say so plainly. Suggest the closest TRADABLE stock only if it's honestly close.\n- Respect anything they say to skip.\n\n${catalogText(stocks, dex)}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{
      role: "user",
      content: `Brief: """${input.brief}"""\nPersonality: ${input.personality}\nAlready excluded by the user: ${input.exclusions.join(", ") || "none"}`,
    }],
  });
  if (res.stop_reason === "refusal") throw new ResearchError("refused", "I couldn't work with that brief. Try saying it another way?");
  if (!res.parsed_output) throw new ResearchError("parse_failed", "I couldn't make sense of that brief. Try saying it another way?");
  return res.parsed_output;
}

// ---------- step 2: research ----------

const SUBMIT: Anthropic.Beta.BetaTool = {
  name: "submit_research",
  description: "Submit the finished research. Call exactly once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["facts", "assumptions", "opinions"],
    properties: {
      facts: {
        type: "array",
        description: "Verifiable facts from pages you found in this search. 1-2 per stock.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ticker", "text", "source_url", "source_title"],
          properties: {
            ticker: { type: "string" },
            text: { type: "string", description: "One plain sentence, in the pet's voice. Include the date or period when it matters." },
            source_url: { type: "string", description: "Exact URL of a search result that supports the fact" },
            source_title: { type: "string" },
          },
        },
      },
      assumptions: { type: "array", items: { type: "string" }, description: "2-3 things this plan assumes about the user or the world. Plain sentences." },
      opinions: { type: "array", items: { type: "string" }, description: "2-3 sentences of your take, including at least one honest trade-off or risk of this plan." },
    },
  },
};

type Submitted = { facts: { ticker: string; text: string; source_url: string; source_title: string }[]; assumptions: string[]; opinions: string[] };

const norm = (u: string) => u.trim().replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

async function research(client: Anthropic, theme: string, picks: { ticker: string; name: string }[]) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `The user wants: ${theme}.\nThe plan holds: ${picks.map((p) => `${p.name} (${p.ticker})`).join(", ")}.\n\nSearch the web for recent, citable facts about each company that matter to this theme: latest earnings or guidance, company announcements, regulatory filings. Prefer primary sources (investor relations pages, SEC filings) and major outlets. Then call submit_research. Only include facts supported by a page you found; use that page's exact URL. Don't quote stock prices.`,
  }];
  const seen = new Set<string>();
  const titles = new Map<string, string>();

  for (let turn = 0; turn < 6; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: VOICE,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }, SUBMIT],
      tool_choice: { type: "auto" },
      messages,
    });
    for (const b of res.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content))
        for (const r of b.content) if (r.type === "web_search_result") { seen.add(norm(r.url)); titles.set(norm(r.url), r.title); }
    }
    if (res.stop_reason === "refusal") throw new ResearchError("refused", "My research got blocked on that one. Try a different brief?");
    const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_research");
    if (call) return { submitted: call.input as Submitted, seen, titles };
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue; // server tool still working; send it back to resume
    messages.push({ role: "user", content: "Please call submit_research now with what you found." });
  }
  throw new ResearchError("no_result", "My research ran long and didn't finish. Try again?");
}

// ---------- the pipeline ----------

export class ResearchError extends Error {
  constructor(public code: string, public friendly: string) { super(friendly); }
}

export async function runResearch(input: ResearchInput): Promise<Proposal> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ResearchError("not_configured", "My research brain isn't set up on this server yet.");
  const client = new Anthropic();
  const catalog = await listStocks();
  const byTicker = new Map(catalog.stocks.map((s) => [s.ticker, s]));
  const official = new Set(catalog.stocks.filter((s) => s.navFeed).map((s) => s.ticker));
  const dex = await dexTradable(catalog.stocks);
  const dexSet = new Set(dex.map((s) => s.ticker));
  const tradable = new Set([...official, ...dexSet]);

  const parsed = await parseBrief(client, input, catalog.stocks, dex);

  // Validate everything the model returned against the real catalog.
  const excluded = [...new Set([...input.exclusions, ...parsed.excluded].map((t) => t.toUpperCase()).filter((t) => byTicker.has(t)))];
  const reasons: Record<string, string> = {};
  const raw: Weights = {};
  for (const p of parsed.picks) {
    const t = p.ticker.toUpperCase();
    if (!tradable.has(t) || excluded.includes(t) || t in raw) continue;
    raw[t] = Math.min(10, Math.max(1, p.fit));
    reasons[t] = p.reason;
  }
  if (!Object.keys(raw).length)
    throw new ResearchError("no_match", "Nothing on Base matches that yet. Want to try a broader brief, like big tech or AI?");

  const weights = fit(raw, input.maxPct);
  const cash = cashOf(weights);
  const lead = leadOf(weights);
  const name = (t: string) => byTicker.get(t)?.name.replace(/,? (Inc|Corp|Corporation|PBC|Ltd|Holdings|Group|Company)\.?$/i, "") ?? t;

  const flags: Flag[] = [];
  for (const u of parsed.unavailable) flags.push({ kind: "unavailable", title: u.title, body: u.note });
  const dexPicks = Object.keys(weights).filter((t) => dexSet.has(t));
  if (dexPicks.length) {
    const names = dexPicks.map(name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    flags.push({
      kind: "dex",
      title: `${list} ${dexPicks.length > 1 ? "have" : "has"} no official price`,
      body: `${dexPicks.length > 1 ? "They trade" : "It trades"} on Base exchanges, so I price ${dexPicks.length > 1 ? "them" : "it"} from those pools instead of a Chainlink feed. I'll ask before every trade, and keep each one under ${Math.round(DEX_RULES.maxTradeShareOfPool * 100)}% of the pool so the price doesn't slip.`,
    });
  }
  if (cash > 0.005)
    flags.push({
      kind: "cash",
      title: `${Math.round(cash * 100)}% stays in USDC for now`,
      body: `Only ${Object.keys(weights).length} stocks match what you asked for, and none can go over ${input.maxPct}%. I'd rather hold cash than break your rule.`,
    });

  const { submitted, seen, titles } = await research(client, parsed.theme, Object.keys(weights).map((t) => ({ ticker: t, name: name(t) })));
  const facts: Fact[] = [];
  let droppedFacts = 0;
  for (const f of submitted.facts ?? []) {
    const t = f.ticker.toUpperCase();
    const ok = t in weights && /^https:\/\//.test(f.source_url) && seen.has(norm(f.source_url));
    if (!ok) { droppedFacts++; continue; }
    facts.push({ ticker: t, text: f.text, url: f.source_url, title: f.source_title || titles.get(norm(f.source_url)) || new URL(f.source_url).hostname });
  }

  return {
    brief: input.brief,
    theme: parsed.theme,
    weights, cash, lead, excluded, flags, facts,
    assumptions: (submitted.assumptions ?? []).slice(0, 4),
    opinions: (submitted.opinions ?? []).slice(0, 4),
    reasons,
    priceSource: Object.fromEntries(Object.keys(weights).map((t) => [t, dexSet.has(t) ? "dex" : "chainlink"])),
    catalog: { source: catalog.source, listed: catalog.stocks.length, official: official.size, dex: dexSet.size },
    droppedFacts,
    model: MODEL,
    createdAt: new Date().toISOString(),
  };
}
