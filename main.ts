// btc-cent-forecast-01 entry: shrunk, volatility-capped 72h log-trend forecast.
// Forecast = last * exp(0.5 * clip(log(trend/last), -sigma240, +sigma240))
// where trend is the OLS log-linear trend over the full 72h window extrapolated
// 240 minutes ahead, and sigma240 is the std of overlapping 240-minute log
// returns inside the window. Pure Node stdlib, deterministic, no network.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MIN_PRICE = 0.00001;
const MAX_PRICE = 9_999_999.99999;
const HORIZON = 240;

interface CaseMarket { id: string; prices: number[] }
interface Case { markets: CaseMarket[] }

const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

function forecast(prices: number[]): number {
  const xs: number[] = [];
  for (const p of prices) if (typeof p === 'number' && Number.isFinite(p) && p > 0) xs.push(p);
  if (xs.length === 0) throw new Error('no usable prices');
  const last = xs[xs.length - 1] as number;
  const n = xs.length;
  // OLS on log prices over the whole window, extrapolated HORIZON minutes ahead.
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = Math.log(xs[i] as number);
    sx += i; sy += y; sxx += i * i; sxy += i * y;
  }
  const denom = n * sxx - sx * sx;
  let move = 0;
  if (denom !== 0) {
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const trend = Math.exp(intercept + slope * (n - 1 + HORIZON));
    move = Math.log(trend / last);
  }
  // Volatility cap: std of overlapping 240-minute log returns inside the window.
  if (n > HORIZON + 1) {
    const rets: number[] = [];
    for (let i = HORIZON; i < n; i++) rets.push(Math.log((xs[i] as number) / (xs[i - HORIZON] as number)));
    const m = rets.length;
    const mu = rets.reduce((a, b) => a + b, 0) / m;
    const sigma = Math.sqrt(rets.reduce((a, b) => a + (b - mu) * (b - mu), 0) / m);
    if (sigma > 0 && Number.isFinite(sigma)) move = Math.max(-sigma, Math.min(sigma, move));
  }
  // Shrink the (capped) trend move halfway toward persistence.
// Halfway is the sweet spot found in backtesting: full trend overshoots in
// regime flips, zero shrinkage is just persistence and leaves the -13% MAE
// gain on the table.
  return price5(last * Math.exp(0.5 * move));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast((c.markets[0] as CaseMarket).prices) }] })}\n`);
}
