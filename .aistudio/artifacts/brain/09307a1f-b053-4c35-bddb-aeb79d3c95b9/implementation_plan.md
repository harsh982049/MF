# Indian Mutual Funds Quantitative & Portfolio Risk Analytics Platform

A production-grade, institutional-quality quantitative analytics dashboard for Indian Mutual Funds and an exportable modular Python Streamlit application (`data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`). It enables dynamic historical NAV ingestion via mfapi.in and benchmark series, vectorized performance and risk analytics (CAGR, rolling returns, Sharpe, Sortino, Jensen's Alpha, Beta, Tracking Error, Drawdowns), ISIN-level portfolio overlap matrix, liquidity stress testing (30-day ADTV), and interest rate duration sensitivity simulations.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Key design and architecture decisions confirmed based on your requirements:
> - **Dual-Delivery Architecture**: An interactive, responsive institutional-grade dashboard running directly in the workspace, complemented by a complete modular Python Streamlit suite (`data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`) with 1-click code export and download.
> - **Preset Portfolio**: Curated blend across major market segments—Parag Parikh Flexi Cap (`122639`), Motilal Oswal Midcap (`127042`), HDFC Top 100 Large Cap (`118989`), and Nippon India Small Cap (`118778`), benchmarked against Nifty 50, Nifty 500, and Nifty Midcap 150.
> - **Liquidity & Stress Horizon**: 30-day Average Daily Trading Volume (ADTV) baseline with 10% market participation threshold for calculating 25% and 50% liquidation horizons.

---

### 1. Overview & Core Concept

- **What It Does**: Provides portfolio managers, wealth advisors, and quantitative analysts with deep diagnostic tools for Indian mutual funds. Combines time-series performance evaluation with structural portfolio risk: rolling return distributions, benchmark outperformance hit-rates, capital market line metrics, pairwise ISIN overlap, sector and market-cap look-throughs, portfolio liquidity liquidation timeframes, and fixed-income duration shock models.
- **Target Audience**: Quant analysts, mutual fund distributors (MFDs), registered investment advisors (RIAs), and individual retail quants analyzing Indian equities and hybrid/debt allocations.
- **Key Value**: Replaces surface-level point-to-point returns with institutional risk metrics: rolling return consistency, true holding overlap (avoiding duplicate underlying stock concentration), market liquidity constraints, and interest rate sensitivity.

---

### 2. User Experience & Visual Design

Following SaaS & Quantitative Dashboard guidelines (`references/3_saas_dashboard.md`):
- **Layout & Canvas**: High-density institutional layout with a collapsible sidebar for fund selection, benchmark index switcher, date window selector (1Y, 3Y, 5Y, Max), and risk-free rate adjustment slider (default 6.5% for Indian 10Y G-Sec).
- **Navigation Tabs**:
  1. **Performance & Rolling Engine**: Cumulative NAV growth rebased to 100 vs. benchmark, annual CAGR matrix (1Y, 3Y, 5Y, 7Y), 3Y and 5Y rolling return distribution box plots (Mean, Median, 25th/75th percentiles, Min, Max), and Benchmark Hit Rate (% of periods beating benchmark).
  2. **Risk & Capital Market Metrics**: Annualized Volatility, Sharpe Ratio, Sortino Ratio, Maximum Drawdown curve with peak-to-trough recovery duration, Beta vs. Jensen's Alpha scatter plot with bubble sizes reflecting Information Ratio, and R² against the benchmark.
  3. **Portfolio Overlap & Holdings**: Dynamic $N \times N$ pairwise ISIN overlap matrix ($\sum \min(w_A, w_B)$), look-through Large/Mid/Small cap allocation stack, top sector concentration comparisons, and shared stock exposure drill-down.
  4. **Liquidity & Duration Stress Test**: 30-day ADTV days-to-liquidate gauge (25% and 50% redemption scenarios), Macaulay and Modified duration sensitivity curve with interactive interest rate shock slider ($\pm 50$, $\pm 100$, $\pm 200$ bps).
  5. **Python Streamlit Code Suite**: Code viewer with syntax highlighting and instant download for all 5 Python modules (`data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`, plus `requirements.txt`).
- **Typography & Color Palette**:
  - *Typography*: Plus Jakarta Sans for crisp display and navigation, paired with JetBrains Mono / tabular numerals (`tabular-nums`) for exact decimal vertical alignment across financial tables.
  - *Palette*: Deep Slate/Navy canvas (`#0b0f19` / `#111827`), clean muted borders (`#1f2937`), emerald for positive alpha and returns (`#10b981`), crimson for drawdowns and negative shocks (`#ef4444`), and indigo/cyan accents for benchmark references (`#6366f1` / `#06b6d4`).

---

### 3. Key Technical Decisions & Modular Python Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE & INGESTION                       │
│  api.mfapi.in/mf/{scheme_code}   │   yfinance (Nifty 50, 500, Mid 150)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
       In-Memory SQLite (:memory:)     Pandas / React State Cache
       Normalized Daily Date Series    Merged Fund & Benchmark NAVs
                   │                               │
       ┌───────────┴───────────────────────────────┴───────────┐
       ▼                                                       ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│     QUANTITATIVE ENGINE      │        │     PORTFOLIO OVERLAP &      │
│  - CAGR (1Y, 3Y, 5Y, 7Y)     │        │        STRESS TESTING        │
│  - 3Y/5Y Rolling Returns     │        │  - ISIN Overlap Matrix       │
│  - Benchmark Hit Rate        │        │  - Market Cap & Sector Mix   │
│  - Sharpe / Sortino (Rf 6.5%)│        │  - 30D ADTV Liquidity Stress │
│  - Beta, Alpha, R2, IR, TE   │        │  - Duration Rate Shocks      │
│  - Max Drawdown & Recovery   │        │    (Macaulay & Mod Duration) │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION & EXPORT LAYER                        │
│  Interactive Institutional Dashboard   │   Exportable Python Modules:  │
│  (Plotly Charts, Risk Tables, Heatmaps)│   data_loader.py, quant_engine│
│                                        │   overlap_engine, stress_test │
│                                        │   app.py (Streamlit runnable) │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Module Specifications:
1. **Module 1 (`data_loader.py`)**:
   - Ingestion from `https://api.mfapi.in/mf/{scheme_code}` with date parsing (`DD-MM-YYYY` to ISO), error resilience for missing days, and forward-filling for holidays.
   - Benchmark ingestion via Yahoo Finance symbols (`^NSEI`, `^CRSLDX`, `NIFTYMIDCAP150.NS`).
   - SQLite `:memory:` database schema with tables `fund_nav` and `benchmark_nav` indexed on `(scheme_code, nav_date)`.
2. **Module 2 (`quant_engine.py`)**:
   - Vectorized rolling returns using rolling calendar windows (756 trading days for 3Y, 1260 trading days for 5Y).
   - Benchmark Hit Rate: $\frac{\text{Count}(\text{Rolling Fund} > \text{Rolling Benchmark})}{\text{Total Windows}} \times 100\%$.
   - Annualized Sharpe: $\frac{\bar{R}_p - R_f}{\sigma_p \sqrt{252}}$, Sortino using downside semi-deviation $\sqrt{\frac{1}{N}\sum \min(R_t - R_f/252, 0)^2 \times 252}$.
   - Regression for Beta ($\frac{\text{Cov}(R_p, R_m)}{\text{Var}(R_m)}$), Jensen's Alpha ($R_p - [R_f + \beta(R_m - R_f)]$), and $R^2$.
   - Max Drawdown: Peak cumulative return tracking and days between peak and recovery.
3. **Module 3 (`overlap_engine.py`)**:
   - Pairwise overlap: $\text{Overlap}(A, B) = \sum_{i \in A \cap B} \min(W_{A,i}, W_{B,i})$.
   - Market cap classification breakdown (Large Cap top 100, Mid Cap 101–250, Small Cap 251+) and sector classification (Financial Services, Technology, Consumer Goods, Healthcare, Industrials, etc.).
4. **Module 4 (`stress_test.py`)**:
   - Days to liquidate $P\%$ portfolio: For each holding $i$, $\text{Days}_i = \frac{W_i \times \text{AUM}}{\text{ADTV}_i \times 10\% \text{ participation}}$. Portfolio liquidation threshold calculated via weighted liquidity curves for 25% and 50% redemption demands.
   - Macaulay & Modified Duration NAV shock: $\Delta \text{NAV} \approx -D_{\text{mod}} \times \Delta y + \frac{1}{2} C \times (\Delta y)^2$.
5. **Module 5 (`app.py`)**:
   - Complete multi-tab Streamlit application with `st.sidebar`, Plotly charts, interactive sliders, and fallback data for instant zero-configuration local execution (`streamlit run app.py`).

---

### 4. Implementation Steps & Verification Plan

1. **Backend / Data Layer**:
   - Express proxy endpoint in `server.ts` to seamlessly proxy `mfapi.in` to prevent any browser CORS limitations, while providing instantaneous cached fallback metrics for offline resilience.
   - Export bundle generator packaging all 5 Python files and `requirements.txt`.
2. **Frontend Quant Analytics Engine**:
   - TypeScript quant math engine duplicating Python NumPy/Pandas logic with identical precision for instant client-side interactivity.
   - High-density visual components: Rebased performance chart, rolling return distributions, risk metric matrix, alpha vs beta scatter plot, overlap heatmap, sector breakdown, and interest rate sensitivity simulator.
3. **Python Code Repository & Exporter**:
   - Provide full source code viewer with copy buttons and single-zip or direct script download for `data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`, and `requirements.txt`.
4. **Verification**:
   - Run `compile_applet` and `lint_applet` to verify TypeScript builds, ensure zero runtime warnings, test all interactive controls, and test API ingestion.
