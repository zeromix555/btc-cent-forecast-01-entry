# btc-cent-forecast-01

Forecast Bitcoin's price 4 hours ahead, 12 times over 48 hours.

## Strategy (v2)

Shrunk, volatility-capped 56h log-trend forecast:

```
forecast = last * exp(0.5 * clip(log(trend / last), -sigma240, +sigma240))
```

- **trend** — OLS log-linear trend fitted over the last 56h window (3,360 closes),
  extrapolated 240 minutes ahead.
- **sigma240** — standard deviation of overlapping 240-minute log returns inside
  the window; it caps the trend move so a steep short-term slope cannot blow the
  forecast up in a regime flip.
- **0.5 shrinkage** — the capped trend move is halved toward persistence, a
  guard against trend blowups when the regime flips.

v2 changes only the window vs v1 (72h / 4,320 closes). The window sweep at
shrink 0.5 / cap 1 sigma is a smooth U with a broad plateau at W=3120–3600
(practice MAE $383.21 / $379.89 / $379.26 / $381.15 / $384.89) vs $409.84 at
W=4320 and $400.56 at W=2880, so W=3360 is the plateau centre, not a
cherry-picked spike. The early ~16h of the 72h window come from a
mean-reverting regime that drags the OLS slope the wrong way.

Rejected: raising the shrink toward 1.0 (practice MAE down to $357.53 at
W=4320) — it worsens the rolling 4h-step checkpoints monotonically (full
trend $391.34 at W=2880 rolling vs v1 $320.60), i.e. overfitting to the 5
practice cases. Mean-reversion terms, EMA smoothing, and 60-minute momentum
were all worse or regime-fragile and were rejected too.

Fallbacks: non-finite or non-positive prices are skipped; the output price is
clamped to (0.00001, 9,999,999.99999) and rounded to 5 decimals.

## Backtest (practice cases p00–p04, target = next case's checkpoint close)

| case | v2 forecast | actual | error | v1 error |
|------|-------------|--------|-------|----------|
| p00 | 74543.45970 | 74447.80384 | $95.66 | $147.96 |
| p01 | 74345.76583 | 73680.83594 | $664.93 | $717.82 |
| p02 | 73890.20699 | 73210.50202 | $679.70 | $685.09 |
| p03 | 73472.71577 | 73777.35178 | $304.64 | $331.82 |
| p04 | 73697.26143 | 73545.88170 | $151.38 | $166.53 |

Model MAE **$379.26** vs v1 **$409.84** (−7.5%) vs persistence baseline
**$470.55** (−19%). All 5 cases improve on v1. Rolling 4h-step checkpoints
on the merged 92h series: model $298.83 (9 checkpoints) vs persistence
$327.57 on the same checkpoints. Two local runs of main.ts produce
byte-identical outputs on all 6 practice cases.

## Implementation

Pure Node 22 stdlib, deterministic, no network. Runs in under a second for all
6 practice cases.

```
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```
