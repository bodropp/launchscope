// LaunchScope farm plans: a farm plan for every board row, templated from the protocol's
// own record (category, chains, TVL, age) — never from a hand-written list of names, and
// never inventing a contract address, a token name or a URL.
//
// Every plan is six steps. Each step names what to do, what it costs and how long it takes,
// because a plan without a cost or a clock is a slogan. Steps are generic guidance: the
// dashboard says so, and the reader checks every step on the protocol's own page.

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
function familyOf(p: SnapshotProtocol): 'lend' | 'dex' | 'bridge' | 'stake' | 'rwa' | 'general' {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) return 'lend';
  if (c.includes('stak')) return 'stake';
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
    case 'general':
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
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
 */
export function farmSteps(p: SnapshotProtocol, ageDays: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(ageDays);
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
      text: `Repeat one qualifying action every week — a deposit, a borrow, a swap or a vote — so the wallet shows steady activity. ${chainNote(p, chain)}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days, and check the protocol's own points or rewards page once a week to confirm the activity is counted.`,
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
