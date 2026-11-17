// LaunchScope's value model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and
// adds the 160 pre-token protocols below the floor with the most TVL: the early rows the
// radar exists to find. A protocol is pre-token when its record carries no token (no market
// cap, no CoinGecko id, no symbol). The snapshot's live-token protocols are kept apart and
// shown as the market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, never from a list of names:
//
//   implied = TVL x categoryMultiple x growthFactor x ageFactor x breadthFactor
//
//   categoryMultiple  a table by DefiLlama category (below): what a dollar of TVL in that
//                     kind of protocol is worth if it ever issues a token. RWA and
//                     launchpads score highest, bridges lowest, everything else 0.20.
//                     The table names every category the snapshot's pre-token protocols
//                     carry, so no row falls back to the default by accident.
//   growthFactor      = 1 + clamp(change_7d, -50, +300) / 250: a protocol whose TVL grew
//                     100% in a week scores 1.40, one that fell 50% scores 0.80. The cap
//                     sits at +300% because the snapshot's own figures run that far: three
//                     pre-token protocols grew past 100% in a week, the fastest by 4,448%,
//                     and a cap of 100% would score them all the same as a protocol up
//                     exactly 100%.
//   ageFactor         = 1 + 0.30 x min(log10(1 + ageMonths) / log10(37), 1): a protocol
//                     that has run with no token for three years scores 1.30, one that has
//                     run two years scores about 1.27, a newborn 1.00. Age in months is
//                     log-scaled and capped at 36 months, so time adds value that flattens
//                     out instead of running away. Unknown age counts as 12 months.
//   breadthFactor     = 1 + 0.015 x min(chains - 1, 5): a protocol live on more chains
//                     reaches more farmers, so each extra chain adds 1.5% of value, up to
//                     7.5% for six chains or more. A single-chain protocol scores 1.00.
//
// The constants are the model's, stated in the dashboard and shown per row in the detail
// view, so a reader can check any row's value against its own figures. No protocol name
// is ever special-cased: the same function scores every row.

import { farmSteps, stepText } from './farm.ts';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the detail view breaks down. */
export interface ModelConstants {
  default_multiple: number;
  growth_floor: number;
  growth_cap: number;
  growth_divisor: number;
  age_weight: number;
  age_cap_months: number;
  unknown_age_months: number;
  breadth_step: number;
  breadth_cap_chains: number;
}

export const MODEL: ModelConstants = {
  default_multiple: 0.2,
  growth_floor: -50,
  growth_cap: 300,
  growth_divisor: 250,
  age_weight: 0.3,
  age_cap_months: 36,
  unknown_age_months: 12,
  breadth_step: 0.015,
  breadth_cap_chains: 6,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'launchscope-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Launched view carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * What a dollar of TVL is worth if the protocol ever issues a token, by DefiLlama
 * category. A category the table does not name takes the default multiple.
 */
export const CATEGORY_MULTIPLE: Record<string, number> = {
  'RWA': 0.42,
  'Launchpad': 0.38,
  'Chain': 0.35,
  'Lending': 0.35,
  'CDP': 0.32,
  'Dexs': 0.32,
  'Yield': 0.3,
  'Derivatives': 0.3,
  'Yield Aggregator': 0.3,
  'Payments': 0.3,
  'Leveraged Farming': 0.3,
  'Collateral Markets': 0.3,
  'Uncollateralized Lending': 0.3,
  'Prediction Market': 0.3,
  'Risk Curators': 0.28,
  'Onchain Capital Allocator': 0.28,
  'CeDeFi': 0.28,
  'Farm': 0.28,
  'Basis Trading': 0.26,
  'Liquidity Manager': 0.26,
  'Insurance': 0.26,
  'Indexes': 0.26,
  'Restaking': 0.25,
  'Staking Pool': 0.24,
  'Token Locker': 0.24,
  'Governance Incentives': 0.24,
  'Anchor BTC': 0.24,
  'Decentralized BTC': 0.24,
  'Dual-Token Stablecoin': 0.22,
  'Liquid Restaking': 0.22,
  'Stablecoin Wrapper': 0.22,
  'Restaked BTC': 0.22,
  'Crypto Card Issuer': 0.22,
  'Liquid Staking': 0.2,
  'Bridge': 0.15,
  'Canonical Bridge': 0.15,
  'Cross Chain Bridge': 0.18,
  'CEX': 0.1,
  'Interest Rate Derivatives': 0.3,
  'CDP Manager': 0.32,
  'OTC Marketplace': 0.26,
  'Privacy': 0.26,
  'Options Vault': 0.28,
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  age_months: number;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_factor: number;
    age_factor: number;
    breadth_factor: number;
    age_months: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with its farm plan attached. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  growth_factor: number;
  age_factor: number;
  breadth_factor: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A protocol's age in months, from its listed day; unknown age counts as 12 months. */
export function ageMonths(asOf: string, listedAt: string | null, model: ModelConstants = MODEL): number {
  const days = ageDays(asOf, listedAt);
  return days === null ? model.unknown_age_months : days / MONTH_DAYS;
}

/** A category's multiple from the table, or the default when the table does not name it. */
export function categoryMultiple(category: string | null, model: ModelConstants = MODEL): number {
  if (category === null) return model.default_multiple;
  return CATEGORY_MULTIPLE[category] ?? model.default_multiple;
}

/** The growth factor: 1 plus the clamped seven-day change, scaled by the divisor. */
export function growthFactor(change7d: number | null, model: ModelConstants = MODEL): { growthPct: number; growthFactor: number } {
  const raw = finite(change7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
  return { growthPct, growthFactor: 1 + growthPct / model.growth_divisor };
}

/** The age factor: log-scaled months since listing, capped, so time adds value that flattens out. */
export function ageFactor(months: number, model: ModelConstants = MODEL): number {
  const scaled = Math.log10(1 + Math.max(0, months)) / Math.log10(1 + model.age_cap_months);
  return 1 + model.age_weight * Math.min(scaled, 1);
}

/** The breadth factor: each extra chain adds a little value, capped, so reach counts without running away. */
export function breadthFactor(chains: string[], model: ModelConstants = MODEL): number {
  const extra = Math.min(Math.max(chains.length - 1, 0), model.breadth_cap_chains - 1);
  return 1 + model.breadth_step * extra;
}

/** The four factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; growthPct: number; growthFactor: number; ageFactor: number; breadthFactor: number; age: number | null; months: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const months = ageMonths(asOf, protocol.listed_at, model);
  const multiple = categoryMultiple(protocol.category, model);
  const { growthPct, growthFactor: gf } = growthFactor(protocol.change_7d, model);
  const af = ageFactor(months, model);
  const bf = breadthFactor(protocol.chains, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * gf * af * bf));
  return { implied, multiple, growthPct, growthFactor: gf, ageFactor: af, breadthFactor: bf, age, months };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    age_months: round2(s.months),
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.multiple,
      growth_pct: round2(s.growthPct),
      growth_factor: round4(s.growthFactor),
      age_factor: round4(s.ageFactor),
      breadth_factor: round4(s.breadthFactor),
      age_months: round2(s.months),
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The live-token protocols, by market cap, for the dashboard's Launched view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with its farm plan attached. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    growth_factor: row.model.growth_factor,
    age_factor: row.model.age_factor,
    breadth_factor: row.model.breadth_factor,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_slugs: [...snapshot.watchlist],
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
