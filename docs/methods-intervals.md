# Interval method for P(d): how it was chosen

Decided by Gaurav, 2026-10-13. Config: `uncertaintyMethod.interval` in `src/config/analysis.ts`.

## The problem

The "clear pattern" decision uses a Bonferroni-corrected level, 1 − 0.05 / (7 days × 4 metrics) ≈ 0.99821, which sits about 3.1 standard errors into the tail. At that depth, an interval that is only slightly too narrow inflates false alarms a lot.

The first method, a percentile interval from a joint bootstrap over injection weeks and pre-drug weeks, reproduced the true sampling error well:

| Case | Bootstrap SE ÷ true SE |
| --- | --- |
| 30 cycles | 0.96 |
| 8 cycles | 0.92 |

But it was short-tailed with few cycles. Persona B, which has no drug effect, showed a false clear pattern in 14 of 100 seeds (null) and 31 of 100 (placebo). The limit, `maxFalsePatternRate`, is 0.10.

## Options compared

All rows use persona B, `testSeeds` 1–100, 10,000 resamples and the current analysis config.

- **Null:** the real first dose, 30 cycles.
- **Placebo:** pre-drug data only, with a fake first dose 14 weeks into the history, 8 cycles.

| Interval method | Null | Placebo |
| --- | --- | --- |
| Percentile, joint bootstrap | 14/100 | 31/100 |
| Bootstrap SE × t, df = cycles − 1 (no component split, exploratory) | 8/100 | 2/100 |
| Welch–Satterthwaite t, components not scaled by n/(n − 1) | 7/100 | 11/100 |
| **Welch–Satterthwaite t** (`tWelchSatterthwaite`) | **6/100** | **10/100** |
| **df = min(cycles, pre-drug weeks) − 1** (`tMinDf`, **chosen**) | **1/100** | **1/100** |

The Welch–Satterthwaite df ranged from 12.6 to 40 under the null (median 20.8) and from 8 to 18 under the placebo (median 15.2).

## How the t options work

The bootstrap is split into two components:
- one that resamples only injection weeks (cycles), with the pre-drug weekday means held fixed;
- one that resamples only pre-drug weeks, with all cycles kept.

Each variance is scaled by n/(n − 1). A bootstrap variance divides by n, while a t interval assumes the unbiased variance, which divides by n − 1. This is the standard correction, not a tuning knob.

SE² = V_cycles + V_preWeeks. The interval is estimate ± t(df) × SE at the band level (95%) and at the corrected decision level. The raw view has no pre-drug component, so its df is cycles − 1.

## Why `tMinDf`

- **Too close to the limit:** Welch–Satterthwaite reached the 0.10 placebo limit at 8 cycles, and the app allows as few as `minCycles` = 6. It can't guarantee false-alarm control at the app's own minimum.
- **Errors aren't symmetric:** for a health-facing app, a false "clear pattern" is worse than a missed one.
- **Cost:** some power. On persona A, seed 42:

| Interval method | Resting HR | HRV | Recovery | Sleep |
| --- | --- | --- | --- | --- |
| `tWelchSatterthwaite` | days 1, 6 | days 1, 6 | days 1, 6 | none |
| `tMinDf` | days 1, 6 | day 6 | day 1 | none |

The Welch–Satterthwaite code and the per-point variance components stay in the engine, so the choice can be revisited.
