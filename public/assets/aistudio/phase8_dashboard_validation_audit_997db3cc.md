# Phase 8: Independent audit of dashboard exports

**Audit date:** 10 November 2026. **Purpose:** Data integrity assessment; **not** investment advice or scheme selection.

## Inputs inspected

- `MF_Daily_NAV_Timeseries_Parag_Parikh_Flexi_Cap_Fund_vs_Motilal_Oswal_Midcap_Fund_2026-11-09_23-57-29.csv`
- `MF_Analytics_Parag_Parikh_Flexi_Cap_Fund_vs_Motilal_Oswal_Midcap_Fund_2026-11-09_23-57-25.json`
- `MF_Comparison_Parag_Parikh_Flexi_Cap_Fund_vs_Motilal_Oswal_Midcap_Fund_2026-11-09_23-57-20.csv`
- The two individual factsheet CSV exports at 23:58, 9 November 2026.
- Previously provided dashboard README.

## Summary

**Do not use the exported benchmark or benchmark-relative statistics for choosing funds.** Parts of the fund NAV data match separately reported AMFI-derived NAV values, but the benchmark, dated metadata, holdings, coverage and statistics contain major reliability concerns.

| Test | Finding | Evidence / implication |
|---|---|---|
| Fund identifiers | AMFI code 122639 / ISIN INF879O01027: PPFAS Direct Growth; code 127042 / ISIN INF247L01445: MO Midcap Direct Growth | Cross-checked with independent AMFI-derived market-data listings |
| NAV end date | PPFAS ₹93.9483 and MO Midcap ₹119.0069, 6 Nov 2026 | Matches independently reported scheme NAVs |
| NAV sample coverage | PPFAS 2,048 non-null observations; MO Midcap 2,049; time span ~12 years | Export is not a complete business-day NAV series; some real fund NAV dates absent (e.g. 4 Nov 2026) |
| Benchmark calendar | 3,024 non-null observations, including **863 weekend rows** | Incompatible with genuine Indian exchange closing-price observations |
| Benchmark 6 Nov movement | Export: **−0.5015%** from 5 Nov; independently reported Nifty 500 TRI: **+1.02%** | Rejected: materially different direction on the same dates |
| Correlation diagnostics | Exported PPFAS vs exported benchmark **0.0185**; MO Midcap vs benchmark **0.0231**; PPFAS vs MO Midcap **0.7028** | Matching-date returns make benchmark data appear disconnected from equity fund returns |
| Reported beta | 0.01 for PPFAS; 0.03 for MO Midcap | Unreliable until recomputed with genuine index TRI |
| Reported R² | 0.000 / 0.001 | Unreliable until recomputed with genuine index TRI |
| PPFAS AUM | Dashboard ₹74,200 Cr versus AMC **₹1,45,070.50 Cr** as of 30 September 2026 | Incorrect or undated/stale dashboard metadata |
| MO Midcap AUM | Dashboard ₹19,400 Cr versus AMC **₹42,851.59 Cr** as of 31 August 2026 | Incorrect or undated/stale dashboard metadata |
| Holdings representation | PPFAS 14 rows totaling **83.45%**, MO Midcap 11 rows totaling **73.30%** | Partial; cannot treat as complete holdings for overlap/concentration calculations |
| Holdings identity | PPFAS export labels ITC with `INE118A01012`, which independent statutory listing identifies with **Bajaj Holdings**; actual ITC ISIN `INE154A01025` | Security-to-ISIN mapping must be validated against official portfolio data |
| Pseudo-ISIN | Both funds use common identifier `CASH_EQUIV` | Must not be counted as the same stock/security in overlap computation |
| Manager tenure | Dashboard PPFAS manager tenure **11.5 years** as of a Nov-2026 export, though Rajeev Thakkar has managed from May 2013 | Stale manager-tenure field |
| Rolling-output reconciliation | JSON claims **3,056** PPFAS 1-year rolling observations while provided CSV contains **2,048** NAV observations | May reflect separate internal full data, but cannot be reproduced from supplied sampled CSV; provenance required |
| Risk-module CAGR | JSON contains `cagr: 25.17` / `27.73` without specifying lookback; sampled NAV first-to-last annualised return about 16.43% / 18.05% | Risk output window/definition cannot be established from export |
| Synthetic fallback | README describes GBM-calibrated synthetic NAV fallback | Cannot prove it triggered in this export without source/logs, but should be disabled for live investment research |

## Separate published source checks

1. PPFAS official factsheet, September 2026: https://amc.ppfas.com/downloads/digital-factsheet/2026/september-2026/ — AUM ₹1,45,070.50 Cr, manager continuity, published fund composition/holdings.
2. Motilal Oswal official fund page (August 2026 as available): https://www.motilaloswalmf.com/mutual-funds/motilal-oswal-midcap-fund — AUM ₹42,851.59 Cr, top holdings including One 97 Communications and Kalyan Jewellers.
3. Independently published AMFI-derived NAV: https://live.giftcitynifty.com/mutual-funds/scheme/122639 and https://live.giftcitynifty.com/mutual-funds/scheme/127042 — 6 Nov 2026 NAVs and schemes.
4. Published Nifty 500 TRI history: https://manasmoney.com/markets/indices/nifty-500-tri and https://www.investing.com/indices/cnx-500-tri-historical-data — 5 and 6 Nov 2026 movement, confirming the benchmark discrepancy.
5. PPFAS September 2026 holdings listing: https://decryptmutualfunds.com/fund-houses/ppfas/flexi-cap-fund — statutory holdings mapping, including ITC and Bajaj Holdings ISINs.

## Calculations and caveats

- Benchmark 6 Nov return: `(62693.58 / 63009.56 - 1) * 100 = −0.5015%`.
- Correlations: Pearson correlation of simple daily percentage changes after taking only rows with both scheme NAVs and the exported benchmark available. Values are **diagnostic only**, as sampling is incomplete and benchmark is faulty.
- 12-year sampled first-to-last CAGR: `(last_NAV/first_NAV)^(365.2425/days_elapsed) - 1`. **Diagnostic only** and not comparable to the JSON's unspecified `riskMetrics.cagr` window.
- Exported holdings sum includes pseudo-cash identifiers, and unknown/unexported securities are not assumed to be zero.
- The external sources are individually dated; where source dates differ, this is an audit warning, not a same-date fund-comparison ranking.

## Required corrections before using dashboard metrics

1. Disable synthetic NAV/benchmark fallback in investment-research mode. Mark missing downloads as failures.
2. Supply **actual Nifty 500 TRI** and **Nifty Midcap 150 TRI** daily histories from traceable index-provider data, with real trading calendars and timestamps.
3. Export full unsampled scheme NAV data and source provenance for each point; no artificial chart downsampling in raw-data exports.
4. Refresh factsheet and holdings data from actual dated AMC monthly scheme disclosures; validate ISIN-to-security mappings and that total portfolio weights reconcile.
5. Recompute CAGR, rolling returns, drawdown, Sharpe, Sortino, beta, Jensen's alpha, R², tracking error, information ratio, capture ratios from aligned genuine returns and documented lookbacks.
6. Do not use generic `CASH_EQUIV` to calculate common-stock overlap; separate or exclude non-security placeholders.
7. Include each metric's calculation period, annualisation convention, benchmark, risk-free rate, scheme ISIN, plan, holdings as-of date and source URL.

## Phase 8 investment-process decision

Continue independent research of Architectures B, D and E. **Do not infer whether PPFAS or MO Midcap is better from the dashboard's alpha or other benchmark-relative outputs.** Verify the current official fund disclosures and independently compute returns/risks before ranking funds. Portfolio selection remains pending.
