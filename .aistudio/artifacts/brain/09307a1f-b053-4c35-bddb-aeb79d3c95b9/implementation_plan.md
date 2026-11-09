# Dynamic Export Naming, Complete Metrics Export, Expanded Tenures & Documentation

Enhance the Indian Mutual Funds Quantitative & Risk Analytics Platform with descriptive timestamped export filenames, full rolling distributions and hit rates in exported reports, expanded tenure horizons (3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y, Max) with graceful `N/A` handling, and deep architectural documentation in `README.md`.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Key design and architectural specifications:
> - **Export Filename Convention**:
>   - Single Fund: `MF_[Fund_Name]_[YYYY-MM-DD_HH-mm-ss].[ext]` (e.g. `MF_Parag_Parikh_Flexi_Cap_2026-11-09_15-30-00.csv`).
>   - Multiple Funds (2–3 funds): `MF_[FundA]_[FundB]_[YYYY-MM-DD_HH-mm-ss].[ext]`.
>   - Portfolio (>3 funds): `MF_Portfolio_[N]_Funds_[LeadFund]_[YYYY-MM-DD_HH-mm-ss].[ext]`.
> - **Comprehensive Export Data Scope**:
>   - Trailing returns: 1Y, 3Y, 5Y, 7Y, 10Y.
>   - 1Y, 3Y, 5Y Rolling Return Distribution statistics: Mean, Median, Min, Max, 25th %ile, 75th %ile, Std Dev, % Positive Windows, % Negative Windows.
>   - 1Y, 3Y, 5Y Rolling Benchmark Hit Rates (%).
>   - Complete risk metrics: Volatility, Sharpe, Sortino, Beta, Alpha, R², Tracking Error, Info Ratio, Max DD, Recovery Days, Calmar Ratio, Capture Ratios.
>   - Factsheet qualitative facts: Fund House, Category, AUM, Direct TER, Turnover, Manager, Tenure, Riskometer.
> - **Expanded Tenure Horizons**:
>   - Added intervals: `3 Months`, `6 Months`, `1 Year`, `3 Years`, `5 Years`, `7 Years`, `10 Years`, and `Max`.
>   - Resilient handling: When a fund has shorter history than the chosen window, cleanly display `N/A` (or actual available annualized return) with a tooltip note, preventing layout breaks or artificial zero returns.
> - **In-Depth README**: Comprehensive documentation of quantitative formulas, SEBI liquidity stress methodology, SQLite :memory: normalization, and Streamlit execution guide.

---

### 1. Proposed Changes & Technical Implementation

#### A. Data Export Modal & Filename Sanitizer (`src/components/DataExportModal.tsx`)
- Implement a filename sanitizer replacing spaces and special characters with clean underscores.
- Format local datetime as `YYYY-MM-DD_HH-mm-ss`.
- For single fund exports: name incorporates the fund's exact title.
- For comparison exports: name incorporates the active fund names or portfolio count with timestamp.
- Enrich the exported CSV rows and JSON payloads with:
  - 1Y, 3Y, 5Y Rolling Return Mean, Median, Min, Max, Q25, Q75, Std Dev, and % Positive.
  - 1Y, 3Y, 5Y Rolling Benchmark Hit Rate (%).
  - Complete trailing CAGR and risk metrics.

#### B. Tenure Horizon Expansion & N/A Fallback (`src/App.tsx` & `src/utils/quantEngine.ts`)
- Update horizon state to support both fractional years (0.25Y for 3M, 0.5Y for 6M) and extended years (1Y, 3Y, 5Y, 7Y, 10Y, 12Y/Max).
- Update `computeTrailingCagr`: when history is shorter than the target window, return `undefined` (rendered as `N/A` in UI and blank in CSV) unless at least 80% of the period is available.
- Update `computeRollingReturns` and `computeBenchmarkHitRate`: return `N/A` when history is shorter than the rolling window, avoiding 0% distortion.

#### C. In-Depth Documentation (`README.md`)
- Overhaul `README.md` to cover:
  1. System Architecture & Dual-Engine Design (React Web + Modular Python Streamlit).
  2. Mathematical Formulas (CAGR, Rolling Returns, Downside Semi-Deviation, Sharpe, Sortino, Jensen's Alpha, Beta, Tracking Error, Information Ratio, Calmar, Capture Ratios).
  3. SEBI Liquidity Stress Methodology (30-day ADTV, 10% volume participation cap, Waterfall vs Pro-Rata liquidation models).
  4. Debt Duration & Convexity Sensitivity ($D_{\text{mod}}$, Rate shock second-order Taylor series approximation).
  5. In-Memory SQLite normalization and multi-scheme calendar forward filling.
  6. Python modular breakdown and local Streamlit execution guide.

---

### 2. Verification & Execution Status

- [x] **A. Dynamic Timestamped Filename Engine**: `getExportFilename()` in `src/components/DataExportModal.tsx` automatically generates clean filenames including fund name(s) and current timestamp (`YYYY-MM-DD_HH-mm-ss`) for single funds, two-fund matchups, and multi-fund portfolios.
- [x] **B. Complete Metrics Export**: Exported CSV and JSON files now include trailing returns (3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y), 1Y/3Y/5Y/7Y rolling return distributions (Mean, Median, Min, Max, 25th %ile, 75th %ile, Std Dev, % Positive), rolling benchmark hit rates (%), risk ratios, and qualitative factsheet details.
- [x] **C. Expanded Tenure Horizons & N/A Resilience**: Sidebar and metric matrices offer 3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y, and Max (12Y) options. Cumulative charts automatically slice and rebase to 100 for the selected tenure. When comparing funds of unequal age, insufficient periods cleanly render as `N/A`.
- [x] **D. In-Depth Documentation**: `README.md` thoroughly updated with mathematical formulas (CAGR, Rolling Returns, Downside Semi-Deviation, Sharpe, Sortino, Jensen's Alpha, Beta, Tracking Error, Information Ratio, Calmar, Capture Ratios), SEBI 30-day ADTV liquidity stress mechanics, debt duration & convexity Taylor series model, modular Python suite execution, and data reliability.
