# btc-cent-forecast-01

Forecast Bitcoin's price 4 hours ahead, 12 times over 48 hours.

## Strategy

Shrunk, volatility-capped 72h log-trend forecast:

```
forecast = last * exp(0.5 * clip(log(trend / last), -sigma240, +sigma240))
```

- **trend** — OLS log-linear trend fitted over the full 72h window (4,320 closes),
  extrapolated 240 minutes ahead.
- **sigma240** — standard deviation of overlapping 240-minute log returns inside
  the window; it caps the trend move so a steep short-term slope cannot blow the
  forecast up in a regime flip.
- **0.5 shrinkage** — the capped trend move is halved toward persistence, a
  guard against trend blowups when the regime flips.

Fallbacks: non-finite or non-positive prices are skipped; the output price is
clamped to (0.00001, 9,999,999.99999) and rounded to 5 decimals.

## Backtest (practice cases p00–p04, target = next case's checkpoint close)

| case | forecast | actual | error |
|------|----------|--------|-------|
| p00 | 74595.75938 | 74447.80384 | $147.96 |
| p01 | 74398.65678 | 73680.83594 | $717.82 |
| p02 | 73895.58845 | 73210.50202 | $685.09 |
| p03 | 73445.53578 | 73777.35178 | $331.82 |
| p04 | 73712.41129 | 73545.88170 | $166.53 |

Model MAE **$409.84** vs persistence baseline **$470.55** (−13%).
Rolling 4h-step checkpoints on the merged 92h series: model $327.2 (W=2880) /
$471.2 (W=4320) vs persistence $340.2 / $527.4 — never catastrophically worse
than persistence in any evaluation.

## Implementation

Pure Node 22 stdlib, deterministic, no network. Runs in under a second for all
6 practice cases.

```
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```
