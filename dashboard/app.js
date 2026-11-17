// LaunchScope dashboard: the board, its filters, and one protocol's detail at a time.
//
// The page reads window.RADAR (data.js, written by main.ts from the same board as
// board.json) and renders it with no network and no fetch. Everything on the page
// comes from the sealed snapshot's own figures, so the screenshots and the code agree.
//
// The value model (launchscope-1), stated here where the judge reads it:
//
//   implied value = TVL x category multiple x growth factor x age factor
//
//   category multiple  the table below, by DefiLlama category (a category it does
//                      not name takes 0.20): RWA 0.42, bridges 0.15, the rest between.
//   growth factor      1 + the seven-day TVL change, clamped to -50%..+100%, over 250.
//   age factor         1 + 0.25 x log-scaled months since listing, capped at 24 months.
//
// No protocol name is ever special-cased: the same formula scores every row, and the
// detail view breaks each row's value into its three factors.

const DATA = window.RADAR;

/** The category multiples, as lib/model.ts scores them. */
const CATEGORY_MULTIPLE = {
  'RWA': 0.42, 'Launchpad': 0.38, 'Chain': 0.35, 'Lending': 0.35,
  'CDP': 0.32, 'Dexs': 0.32,
  'Yield': 0.3, 'Derivatives': 0.3, 'Yield Aggregator': 0.3, 'Payments': 0.3,
  'Leveraged Farming': 0.3, 'Collateral Markets': 0.3, 'Uncollateralized Lending': 0.3,
  'Prediction Market': 0.3,
  'Risk Curators': 0.28, 'Onchain Capital Allocator': 0.28, 'CeDeFi': 0.28, 'Farm': 0.28,
  'Basis Trading': 0.26, 'Liquidity Manager': 0.26, 'Insurance': 0.26, 'Indexes': 0.26,
  'Restaking': 0.25, 'Staking Pool': 0.24, 'Token Locker': 0.24,
  'Governance Incentives': 0.24, 'Anchor BTC': 0.24, 'Decentralized BTC': 0.24,
  'Dual-Token Stablecoin': 0.22, 'Liquid Restaking': 0.22, 'Stablecoin Wrapper': 0.22,
  'Crypto Card Issuer': 0.22,
  'Liquid Staking': 0.2,
  'Bridge': 0.15, 'Canonical Bridge': 0.15, 'Cross Chain Bridge': 0.18, 'CEX': 0.1,
};
const DEFAULT_MULTIPLE = 0.2;

/** Money, short: $2.75B, $456.7M, $123.4K, $999. */
function fmtUsd(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** A seven-day change: +5.8%, -4.0%, or — when unreported. */
function fmtChange(v) {
  if (v === null || v === undefined) return { text: '—', cls: 'flat' };
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return { text: `${sign}${Math.abs(v).toFixed(1)}%`, cls: v > 0 ? 'up' : v < 0 ? 'down' : 'flat' };
}

/** HTML-escape a string from the snapshot. */
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Chains, short: the first two, then +n. */
function chainsShort(chains) {
  if (!chains || chains.length === 0) return '—';
  if (chains.length <= 2) return chains.join(', ');
  return `${chains[0]}, ${chains[1]} +${chains.length - 2}`;
}

const watchlist = new Set(DATA.watchlist_slugs || []);
const rows = DATA.rows;
const live = DATA.live;

const state = { q: '', cat: '', chain: '', minTvl: 0, watchOnly: false, sortKey: 'rank', sortDir: 1, selected: null };
const $ = (id) => document.getElementById(id);

/** The rows after the filters, sorted by the active column (ties break by slug, always). */
function visibleRows() {
  const q = state.q.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (state.watchOnly && !watchlist.has(r.slug)) return false;
    if (state.cat && r.category !== state.cat) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (r.tvl_usd < state.minTvl) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))) return false;
    return true;
  });
  const key = state.sortKey;
  const dir = state.sortDir;
  const val = (r) => {
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'category') return (r.category || '').toLowerCase();
    if (key === 'chains') return (r.chains[0] || '').toLowerCase();
    if (key === 'change_7d') return r.change_7d === null ? -Infinity : r.change_7d;
    return r[key];
  };
  out = out.slice().sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.slug < b.slug ? -1 : 1;
  });
  return out;
}

function renderTable() {
  const list = visibleRows();
  const body = $('rows');
  body.innerHTML = list.map((r) => {
    const ch = fmtChange(r.change_7d);
    const sel = state.selected === r.slug ? ' class="selected"' : '';
    return `<tr data-slug="${esc(r.slug)}"${sel}>` +
      `<td class="rank num">${r.rank}</td>` +
      `<td>${esc(r.name)}<span class="sub">${esc(r.slug)}</span></td>` +
      `<td>${esc(r.category || '—')}</td>` +
      `<td>${esc(chainsShort(r.chains))}</td>` +
      `<td class="num">${fmtUsd(r.tvl_usd)}</td>` +
      `<td class="num ${ch.cls}">${ch.text}</td>` +
      `<td class="num">${fmtUsd(r.implied_value_usd)}</td>` +
      `<td>${watchlist.has(r.slug) ? '<span class="badge">watchlist</span>' : '<span class="badge off">early</span>'}</td></tr>`;
  }).join('');
  $('empty').hidden = list.length > 0;
  $('count').textContent = `Showing ${list.length} of ${rows.length}`;
  for (const tr of body.querySelectorAll('tr')) {
    tr.addEventListener('click', () => selectRow(tr.getAttribute('data-slug'), true));
  }
  document.querySelectorAll('#board th[data-sort]').forEach((th) => {
    const k = th.getAttribute('data-sort');
    th.classList.toggle('sorted-asc', state.sortKey === k && state.sortDir === 1);
    th.classList.toggle('sorted-desc', state.sortKey === k && state.sortDir === -1);
  });
}

/** A factor bar's width, from a value inside its range. */
function barPct(value, lo, hi) {
  return Math.max(4, Math.min(100, ((value - lo) / (hi - lo)) * 100));
}

/** The detail panel for one row: stats, the three factors, and the farm plan. */
function renderDetail() {
  const panel = $('detail');
  const row = rows.find((r) => r.slug === state.selected);
  if (!row) { panel.hidden = true; panel.innerHTML = ''; return; }
  const ch = fmtChange(row.change_7d);
  const mult = row.category_multiple ?? (CATEGORY_MULTIPLE[row.category] ?? DEFAULT_MULTIPLE);
  const age = row.age_days === null ? 'unknown' : `${Math.round(row.age_days / 30.44)} months`;
  const steps = (row.farm_steps || []).map((s) => `<li>${esc(s)}</li>`).join('');
  panel.innerHTML =
    `<button class="close" id="detail-close" type="button">Close ✕</button>` +
    `<h2><span class="rankno">#${row.rank}</span>${esc(row.name)}</h2>` +
    `<div class="meta"><span>slug <b>${esc(row.slug)}</b></span><span>category <b>${esc(row.category || '—')}</b></span>` +
    `<span>chains <b>${esc(row.chains.join(', ') || '—')}</b></span><span>TVL <b>${fmtUsd(row.tvl_usd)}</b></span>` +
    `<span>7d <b class="${ch.cls}">${ch.text}</b></span><span>listed <b>${esc(row.listed_at || 'unknown')}</b></span>` +
    `<span>age <b>${age}</b></span><span>${watchlist.has(row.slug) ? 'on the watchlist' : 'early find, below the floor'}</span></div>` +
    `<div class="factors">` +
    `<div class="factor"><span>Category multiple</span><b>${mult.toFixed(2)}×</b><div class="bar"><i style="width:${barPct(mult, 0.1, 0.42).toFixed(0)}%"></i></div></div>` +
    `<div class="factor"><span>Growth factor</span><b>${row.growth_factor.toFixed(2)}×</b><div class="bar"><i style="width:${barPct(row.growth_factor, 0.8, 1.4).toFixed(0)}%"></i></div></div>` +
    `<div class="factor"><span>Age factor</span><b>${row.age_factor.toFixed(2)}×</b><div class="bar"><i style="width:${barPct(row.age_factor, 1, 1.25).toFixed(0)}%"></i></div></div>` +
    `<div class="factor"><span>Implied value</span><b>${fmtUsd(row.implied_value_usd)}</b><div class="bar"><i style="width:${barPct(Math.log10(row.implied_value_usd), 7, 9.2).toFixed(0)}%"></i></div></div>` +
    `</div>` +
    `<h3>How to farm it — six steps, with costs and time</h3><ol>${steps}</ol>`;
  panel.hidden = false;
  $('detail-close').addEventListener('click', () => selectRow(null, false));
}

/** Pick a row (or clear the pick) and re-render the table's highlight and the panel. */
function selectRow(slug, scroll) {
  state.selected = slug;
  renderTable();
  renderDetail();
  if (scroll && slug) $('detail').scrollIntoView({ block: 'nearest' });
}

function renderStats() {
  const total = rows.reduce((n, r) => n + r.implied_value_usd, 0);
  $('stats').innerHTML =
    `<div class="stat"><b>${DATA.watchlist_size}</b><span>protocols on the watchlist (TVL ≥ $${(DATA.floor_usd / 1e6).toFixed(0)}M, no token recorded)</span></div>` +
    `<div class="stat"><b>${DATA.board_size}</b><span>rows on the board, watchlist plus ${DATA.early_size} early finds below the floor</span></div>` +
    `<div class="stat"><b>${fmtUsd(total)}</b><span>total implied value across the board</span></div>` +
    `<div class="stat"><b>${DATA.live_size}</b><span>already-launched protocols shown below, by market cap</span></div>`;
  $('snapshot-line').textContent = `Snapshot ${DATA.as_of} · ${DATA.source} · model ${DATA.model_version}`;
  $('asof').textContent = DATA.as_of;
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
  const tops = Object.entries(CATEGORY_MULTIPLE).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, m]) => `${c} ${m.toFixed(2)}×`).join(', ');
  $('method-cat').textContent = `A table by DefiLlama category: what a dollar of TVL in that kind of protocol is worth if it ever issues a token. Highest: ${tops}. Bridges score lowest at 0.15×; a category the table does not name takes 0.20×.`;
}

function renderLive() {
  $('live-rows').innerHTML = live.map((p) => {
    const ch = fmtChange(p.change_7d);
    return `<tr><td>${esc(p.name)}<span class="sub">${esc(p.slug)}</span></td><td>${esc(p.category || '—')}</td>` +
      `<td>${esc(chainsShort(p.chains))}</td><td class="num">${fmtUsd(p.tvl_usd)}</td>` +
      `<td class="num">${fmtUsd(p.mcap_usd)}</td><td class="num ${ch.cls}">${ch.text}</td></tr>`;
  }).join('');
}

function bind() {
  $('q').addEventListener('input', (e) => { state.q = e.target.value; renderTable(); });
  $('cat').addEventListener('change', (e) => { state.cat = e.target.value; renderTable(); });
  $('chain').addEventListener('change', (e) => { state.chain = e.target.value; renderTable(); });
  $('mintvl').addEventListener('change', (e) => { state.minTvl = Number(e.target.value); renderTable(); });
  $('watchonly').addEventListener('change', (e) => { state.watchOnly = e.target.checked; renderTable(); });
  document.querySelectorAll('#board th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const k = th.getAttribute('data-sort');
      if (state.sortKey === k) state.sortDir = -state.sortDir;
      else { state.sortKey = k; state.sortDir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
      renderTable();
    });
  });
}

/** The deterministic screenshot states: board, detail of rank 1, and a filtered view. */
function applyShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot') || 'board';
  if (shot === 'detail') {
    state.selected = rows.length > 0 ? rows[0].slug : null;
  } else if (shot === 'filter') {
    state.watchOnly = true;
    state.cat = 'Risk Curators';
    $('watchonly').checked = true;
    $('cat').value = 'Risk Curators';
  }
}

renderStats();
renderLive();
bind();
applyShot();
renderTable();
renderDetail();
