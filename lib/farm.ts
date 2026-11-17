// LaunchScope farm plans: a farm plan for every board row, templated from the protocol's
// own record (category, chains, TVL, age) — never from a hand-written list of names, and
// never inventing a contract address, a token name or a URL.
//
// Every plan is six steps. Each step names what to do, what it costs and how long it takes,
// because a plan without a cost or a clock is a slogan. Steps are generic guidance: the
// dashboard says so, and the reader checks every step on the protocol's own page.
//
// The plan's middle three steps are the family's own: the core action that puts capital
// to work, the weekly action that keeps the wallet active, and what counts — because a
// lending market, a perpetuals exchange and a launchpad do not farm the same way.
import type { SnapshotProtocol } from './model.ts';

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The first chain a protocol names, or a neutral phrase when it names none. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(ageDays: number | null): number {
  if (ageDays === null) return 30;
  if (ageDays < 180) return 60;
  if (ageDays < 365) return 45;
  return 30;
}

/** The category's family, from its DefiLlama name: each family farms differently. */
export type Family =
  | 'lend' | 'dex' | 'bridge' | 'stake' | 'rwa' | 'derivatives'
  | 'prediction' | 'payments' | 'launchpad' | 'insurance' | 'governance' | 'curator' | 'general';

export function familyOf(p: SnapshotProtocol): Family {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('launchpad')) return 'launchpad';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('governance')) return 'governance';
  if (c.includes('risk curators') || c.includes('onchain capital allocator')) return 'curator';
  if (c.includes('payments') || c.includes('crypto card')) return 'payments';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) return 'lend';
  if (c.includes('stak')) return 'stake';
  if (c.includes('deriv') || c.includes('options vault') || c.includes('basis trading')) return 'derivatives';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager') || c === 'farm') return 'dex';
  if (c.includes('rwa') || c.includes('token locker') || c.includes('indexes') || c.includes('anchor btc') || c.includes('decentralized btc') || c.includes('dual-token')) return 'rwa';
  return 'general';
}

/** The family's core action: the one step that actually puts capital to work. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (familyOf(p)) {
    case 'lend': {
      const borrow = Math.max(10, Math.round(capital / 5));
      return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $${borrow} against it and repay the borrow within the week.`;
    }
    case 'dex':
      return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} — half USDC, half the pool's other asset — and keep the position open.`;
    case 'bridge':
      return `Bridge $${capital} of USDC through ${name} to ${chain}, then use the bridged funds once inside the destination app.`;
    case 'stake':
      return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt in the same wallet.`;
    case 'rwa':
      return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the farming wallet.`;
    case 'derivatives': {
      const size = Math.max(25, Math.round(capital / 2));
      return `Open a $${size} perpetual position on ${name} on ${chain} at 2x leverage or less, set a stop loss, and close it within the week.`;
    }
    case 'prediction': {
      const bet = Math.max(10, Math.round(capital / 5));
      return `Place $${bet} across two or three outcome markets on ${name} on ${chain}, on events you have actually read, and let them settle.`;
    }
    case 'payments':
      return `Route $${capital} of real spending through ${name} on ${chain} — a bill, a transfer or a card load — instead of moving it in one lump.`;
    case 'launchpad':
      return `Commit $${capital} of USDC to ${name}'s next launch allocation on ${chain} and hold the allocation through the sale.`;
    case 'insurance':
      return `Buy $${capital} of cover on ${name} on ${chain} for a position you already hold, and keep the cover active.`;
    case 'governance':
      return `Lock $${capital} of the chain's governance asset through ${name} on ${chain} and vote on the next live proposal.`;
    case 'curator':
      return `Allocate $${capital} to ${name}'s curated vault on ${chain} and hold the vault shares in the farming wallet.`;
    case 'general':
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The family's weekly action: the small repeat that keeps the wallet visibly active. */
function weeklyAction(p: SnapshotProtocol): string {
  switch (familyOf(p)) {
    case 'lend':
      return 'Repay a small part of the borrow and borrow it back, so the wallet shows fresh lending activity.';
    case 'dex':
      return 'Swap a small amount through the pool, or add a little more liquidity to the same position.';
    case 'bridge':
      return 'Bridge a small amount again, in the other direction when the protocol counts it.';
    case 'stake':
      return 'Claim the staking rewards and restake them, or top up the stake by a small amount.';
    case 'rwa':
      return 'Check the yield that has accrued and add a small amount to the same asset.';
    case 'derivatives':
      return 'Open and close one small position, at low leverage, and keep the trade history clean.';
    case 'prediction':
      return 'Place one more small prediction on a market that closes within the week.';
    case 'payments':
      return 'Route another small payment through the protocol, on a different day than the last one.';
    case 'launchpad':
      return 'Check for a new launch, join its allowlist, and complete any task the launch asks for.';
    case 'insurance':
      return 'Review the cover before it lapses and renew it, or open cover on a second position.';
    case 'governance':
      return 'Vote on the next proposal, and read the discussion before you cast the vote.';
    case 'curator':
      return 'Check the vault allocation and add a small amount when a new strategy opens.';
    case 'general':
    default:
      return 'Repeat one qualifying action — a deposit, a borrow, a swap or a vote — so the wallet shows steady activity.';
  }
}

/** The chain note: a second chain is a second chance to be counted, when the protocol counts it. */
function chainNote(p: SnapshotProtocol, chain: string): string {
  if (p.chains.length > 1) {
    return `If ${p.name} counts activity on a second chain, repeat the same position once on ${p.chains[1]} with a smaller amount.`;
  }
  return `Do the position on ${chain}, the chain the protocol's TVL is counted on.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. Derived from
 * the protocol's own record (category, chains, TVL, age), never from a list of names.
 * Young protocols get a longer qualifying window and a note that early activity may
 * weigh more; multi-chain protocols get a second-chain note.
 */
export function farmSteps(p: SnapshotProtocol, ageDays: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(ageDays);
  const young = ageDays !== null && ageDays < 180
    ? ' The protocol is young, so activity in its first months may weigh more than later activity — start in the first week.'
    : '';
  return [
    {
      text: 'Open a fresh wallet that holds only the funds you plan to farm, and write its seed phrase on paper and store it offline.',
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Move $${capital} of USDC to ${chain} for ${p.name} — use the chain's own bridge or a bridge you already trust — and keep about $10 aside for gas.`,
      cost: 'about $3 to $12 of bridge and gas fees',
      time: '10 minutes',
    },
    {
      text: coreAction(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `${weeklyAction(p)} ${chainNote(p, chain)}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days, and check the protocol's own points or rewards page once a week to confirm the activity is counted.${young}`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: 'Claim only from a link the protocol itself publishes, never from a message or an ad, and log the wallet, the dates and every transaction so you can unwind the position.',
      cost: 'nothing to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}
