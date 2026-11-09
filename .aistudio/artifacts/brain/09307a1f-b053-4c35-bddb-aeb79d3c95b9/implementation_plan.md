# Comprehensive Mutual Fund Analytics Suite Overhaul (Enhanced Edition)

A production-grade institutional redesign of the Indian Mutual Funds Quantitative & Risk Analytics Platform. Incorporates user specifications (UI decluttering, global search modal, asset-class specific metrics, qualitative factsheets, complete rolling statistics, multi-format CSV/JSON exports) and **complementary quantitative features**: **SIP Wealth Simulator & XIRR Engine**, **Daily Return Correlation Matrix & Diversification Score**, **Upside vs Downside Capture Ratio Quadrant**, and **Universal Fund Screener**.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Key architectural decisions and newly integrated complementary features:
> - **Global Fund Search & Universal Catalog**: A `Cmd+K` / Search modal allowing search across all SEBI categories (Equity: Large, Mid, Small, Flexi, Multi, ELSS; Debt: Corporate Bond, Banking & PSU, Liquid, Gilt; Hybrid: Aggressive, Arbitrage, Balanced Advantage; Commodities: Gold; International FoF).
> - **Asset-Class Adaptive Metrics**:
>   - **Debt Funds**: Yield to Maturity (YTM), Macaulay Duration, Modified Duration, Average Maturity, Credit Quality Distribution (% AAA, % AA+, % Sovereign, % Cash), Rate Sensitivity.
>   - **Equity Funds**: Rolling CAGR distributions, Beta, Alpha, Sharpe, Sortino, Active Share, ISIN Overlap.
>   - **Hybrid Funds**: Look-through Equity/Debt asset allocation breakdown.
> - **Complete Statistical Distribution**: Min, 25th Percentile, Median, Mean (Average), 75th Percentile, Max, Std Dev, % Positive Windows, % Negative Windows, and Calmar Ratio.
> - **Complementary Additions**:
>   1. **SIP Wealth Builder & XIRR Simulator**: Compare lump-sum CAGR with monthly SIP wealth creation (₹ / XIRR) over 1Y, 3Y, 5Y, and 10Y.
>   2. **Return Correlation Matrix & Portfolio Diversification Score (0–100%)**: Pairwise time-series return correlations alongside ISIN holding overlap.
>   3. **Upside vs Downside Capture Ratio Quadrant**: Visualizing bull market participation vs bear market protection.
>   4. **Qualitative Factsheet Dossier**: Fund Manager tenure, credentials, investment philosophy, turnover ratio, expense ratio, and riskometer.
>   5. **Multi-Format Exporter**: Full CSV comparison, structured JSON, individual fund factsheets, and raw historical NAV series.

---

### 1. Overview & Architecture

- **Visual Layout & Scaling**: Container locked to `max-w-[1720px] mx-auto w-full px-6`, strictly aligned with the top navigation bar. Expanded chart heights ($420\text{px}$–$480\text{px}$) with responsive SVG scaling.
- **Top Navigation Bar**: Wordmark `Indian MF Quant Studio`, 6 specialized tabs, Quick-Search button (`Ctrl+K`), Compare Counter chips with instant removal, and Export button.
- **Tabs**:
  1. **Performance & Rolling Engine**: Cumulative growth rebased to 100, Trailing CAGR matrix (1Y, 3Y, 5Y, 7Y), 1Y/3Y/5Y rolling return distribution box plots, full statistical summary table, and Benchmark Hit Rate progress bars (with 10Y+ historical alignment resolving the 5Y hit-rate bug).
  2. **Risk & Capital Market Metrics**: Comprehensive risk matrix (Sharpe, Sortino, Volatility, Beta, Jensen's Alpha, R², Tracking Error, Information Ratio, Calmar Ratio, Max Drawdown & Recovery Days), Beta vs Alpha bubble plot, and Upside/Downside Capture Quadrant.
  3. **Portfolio Overlap & Correlation**: Pairwise ISIN overlap matrix ($\sum \min(W_A, W_B)$), daily return correlation matrix, Portfolio Diversification Score (0–100%), look-through Market Cap and Sector breakdowns, and common holdings inspector.
  4. **Debt & Liquidity Stress Testing**: 30-day ADTV days to liquidate 25% and 50% (waterfall & pro-rata), position-level liquidity table, Macaulay & Modified duration table with rate shock grid, and interactive yield curve shock slider with live simulated NAV.
  5. **SIP Simulator & Wealth Builder**: Dynamic Monthly SIP calculation across selected funds and benchmark, computing invested capital, accumulated corpus, and annualized XIRR.
  6. **Fund Factsheets & Qualitative Dossier**: Manager profiles (name, tenure, experience, active funds), fund facts (inception date, AUM, expense ratio, turnover ratio, riskometer), and category classification.
  7. **Python Streamlit Suite & Data Export**: Code viewer and direct downloads for all 5 Python modules (`data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`, `requirements.txt`), plus multi-format CSV and JSON exports.

---

### 2. Component Hierarchy & Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│               TOP BAR: Brand · Tabs · Search · Compare · Export        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       ▼                                                       ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  SIDEBAR: Quick Filters      │        │  CENTRAL WORKSPACE CANVAS    │
│  - Active Fund Chips         │        │  - Tab 1: Performance & Roll │
│  - Global Search (Ctrl+K)    │        │  - Tab 2: Risk & Alpha       │
│  - Benchmark Index Selector  │        │  - Tab 3: Overlap & Corr     │
│  - Horizon & Rf Rate         │        │  - Tab 4: Debt & Stress      │
│  - ADTV Participation Limit  │        │  - Tab 5: SIP Wealth Builder │
│  - Category Switcher         │        │  - Tab 6: Qualitative Facts  │
└──────────────────────────────┘        │  - Tab 7: Python Suite & Data│
                                        └──────────────────────────────┘
```

---

### 3. Implementation Steps & Verification Plan

1. **Expanded Data Models & Catalog (`src/types/quant.ts` & `src/data/presetFunds.ts`)**:
   - Universal fund catalog across Equity, Debt, Hybrid, Gold, and International FoFs.
   - Qualitative manager profiles and factsheet fields.
   - 10Y+ historical NAV series generator and live `mfapi.in` dynamic lookup for all ~40,000 AMFI schemes.
2. **Enhanced Quantitative Engine (`src/utils/quantEngine.ts`)**:
   - Full rolling statistics (Min, Max, Mean, Median, Q25, Q75, Std, % Positive, % Negative).
   - Upside/Downside Capture Ratios, Calmar Ratio.
   - Monthly SIP & XIRR wealth accumulation calculator.
   - Daily return correlation matrix and Portfolio Diversification Score.
   - Debt credit quality distribution and duration sensitivity.
3. **UI Modals & Visual Components (`src/components/`)**:
   - `FundSearchModal.tsx`: Search across all categories, filters by AMC and asset class, instant Add/Remove.
   - `FundFactsheetModal.tsx`: Manager dossiers, fund objectives, factsheet stats.
   - `DataExportModal.tsx`: Comprehensive CSV, JSON, and raw time-series download.
   - `QuantVisuals.tsx`: Upgraded charts (420px+ viewports), Capture Ratio Quadrant, Correlation Matrix, Rolling Box Plots.
4. **App Integration & Layout Alignment (`src/App.tsx`)**:
   - Full-width aligned canvas (`max-w-[1720px] mx-auto`), responsive tabs, active compare chips with remove buttons.
5. **Python Suite Sync**:
   - Update `data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`, and `requirements.txt`.
6. **Verification**:
   - Co-execute `compile_applet` and `lint_applet` to ensure zero compilation or lint errors.
   - Verify responsive behavior and accurate 5Y rolling hit-rate calculations.
