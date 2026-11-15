# Indian Mutual Funds Quantitative & Risk Analytics Studio

A production-grade, institutional quantitative analytics platform and interactive dashboard engineered for analyzing Indian Mutual Funds. The platform processes high-frequency historical NAV series, quantitative risk-adjusted metrics, portfolio structural composition, SEBI-mandated liquidity stress tests, and fixed-income duration sensitivities.

Delivered as a **dual-architecture platform**:
1. **Interactive Web Quant Terminal**: High-performance React 19 + TypeScript SPA running on Vite and Tailwind CSS.
2. **Modular Python Analytics Suite**: Standalone, exportable Python library (`data_loader.py`, `quant_engine.py`, `overlap_engine.py`, `stress_test.py`, `app.py`) for local execution using Streamlit, Pandas, NumPy, SQLite, and Plotly.

---

## Table of Contents

1. [Key Capabilities & Features](#key-capabilities--features)
2. [Quantitative Mathematical Formulations](#quantitative-mathematical-formulations)
   - [Trailing Returns & Annualized CAGR](#trailing-returns--annualized-cagr)
   - [Rolling Return Distributions & Statistical Spread](#rolling-return-distributions--statistical-spread)
   - [Rolling Benchmark Outperformance Hit Rate](#rolling-benchmark-outperformance-hit-rate)
   - [Risk-Adjusted Ratios (Sharpe & Sortino)](#risk-adjusted-ratios-sharpe--sortino)
   - [Capital Asset Pricing Model (Beta, Alpha, R²)](#capital-asset-pricing-model-beta-alpha-r)
   - [Active Management Metrics (Tracking Error, Information Ratio)](#active-management-metrics-tracking-error-information-ratio)
   - [Drawdowns & High-Water Mark Recovery](#drawdowns--high-water-mark-recovery)
   - [Capture Ratios (Upside & Downside)](#capture-ratios-upside--downside)
3. [Portfolio Structural & Liquidity Stress Engine](#portfolio-structural--liquidity-stress-engine)
   - [ISIN-Level Weighted Portfolio Overlap](#isin-level-weighted-portfolio-overlap)
   - [Market Capitalization & Sector Concentration](#market-capitalization--sector-concentration)
   - [Return Correlation & Diversification Score](#return-correlation--diversification-score)
   - [SEBI 30-Day ADTV Liquidity Stress Testing](#sebi-30-day-adtv-liquidity-stress-testing)
   - [Debt Modified Duration & Convexity Sensitivity](#debt-modified-duration--convexity-sensitivity)
4. [Modular Python Architecture (`streamlit` Suite)](#modular-python-architecture-streamlit-suite)
5. [Web Quant Terminal Features & UI Architecture](#web-quant-terminal-features--ui-architecture)
   - [Global Fund Search & AMFI Explorer (`Cmd+K`)](#global-fund-search--amfi-explorer-cmdk)
   - [Dynamic Active Comparison Strip](#dynamic-active-comparison-strip)
   - [Adaptive Multi-Horizon Analysis & Resilient `N/A` Handling](#adaptive-multi-horizon-analysis--resilient-na-handling)
   - [Fund Factsheets & Qualitative Dossiers](#fund-factsheets--qualitative-dossiers)
   - [SIP Wealth Simulator](#sip-wealth-simulator)
   - [Dynamic Export Engine & Timestamped Naming Conventions](#dynamic-export-engine--timestamped-naming-conventions)
6. [Local Installation & Execution Guide](#local-installation--execution-guide)
7. [Data Pipeline & Ingestion Reliability](#data-pipeline--ingestion-reliability)

---

## Key Capabilities & Features

- **Dynamic AMFI Ingestion**: Live historical daily NAV retrieval from `https://api.mfapi.in/mf/{scheme_code}` covering the entire Indian Mutual Fund universe (Equity, Debt, Hybrid, Solution Oriented, Gold, International FoFs, ETFs).
- **Benchmark Feeds**: Aligned benchmark indices (Nifty 50 `^NSEI`, Nifty 500 `^CRSLDX`, Nifty Midcap 150 `NIFTY_MIDCAP_150.NS`) with calendar forward-filling.
- **Institutional Rolling Analysis**: 1Y, 3Y, 5Y, and 7Y continuous rolling windows calculating Mean, Median, Min (worst-case), Max (best-case), 25th / 75th percentile interquartile range (IQR), standard deviation, positive probability, and benchmark hit rate.
- **Sub-Annual & Multi-Year Horizons**: Multi-duration selector offering 3 Months, 6 Months, 1 Year, 3 Years, 5 Years, 7 Years, 10 Years, and Max History (~12 Years), automatically rebasing cumulative charts and displaying `N/A` for younger schemes.
- **ISIN Look-Through Overlap**: Pairwise $N \times N$ overlap matrix measuring duplicate stock holdings across funds to eliminate false diversification.
- **Regulatory Stress Testing**: SEBI-aligned liquidity stress modeling estimating trading days to liquidate 25% and 50% of portfolio AUM under conservative 10% daily volume participation limits.
- **Fixed-Income Duration Shocks**: Macaulay duration, modified duration, and convexity modeling estimating NAV impact across $\pm 25$ bps to $\pm 200$ bps yield curve shifts.
- **Qualitative Manager Dossiers**: Lead portfolio manager profiles, tenure, educational background, bio, direct vs. regular TER, portfolio turnover, riskometer, and debt credit profile breakdown.
- **Comprehensive Data Exporter**: One-click download of full quantitative matrices and factsheets in CSV and structured JSON, with automated file naming: `MF_[FundName]_[DateTime].[ext]` or `MF_[FundA]_vs_[FundB]_[DateTime].[ext]`.

---

## Quantitative Mathematical Formulations

All computations use vectorized, numerically stable algorithms implemented identically in Python (`quant_engine.py`) and TypeScript (`src/utils/quantEngine.ts`).

### Trailing Returns & Annualized CAGR

For tenures greater than or equal to 1 year ($Y \ge 1.0$), returns are annualized using Compound Annual Growth Rate:

$$\text{CAGR} = \left( \frac{\text{NAV}_t}{\text{NAV}_{t - Y}} \right)^{\frac{1}{Y}} - 1$$

For sub-annual tenures ($Y < 1.0$, such as 3 Months $Y = 0.25$ and 6 Months $Y = 0.50$), point-to-point absolute cumulative return is computed:

$$R_{\text{abs}} = \frac{\text{NAV}_t - \text{NAV}_{t - \Delta t}}{\text{NAV}_{t - \Delta t}}$$

Where a fund does not have sufficient trading history for the requested duration, the engine returns `N/A` rather than extrapolating or defaulting to 0.

### Rolling Return Distributions & Statistical Spread

A rolling return window calculates annualized return for every historical interval of length $W$ trading days (using $252$ trading days per year):

$$R_{\text{roll}, i} = \left( \frac{\text{NAV}_i}{\text{NAV}_{i - W}} \right)^{\frac{252}{W}} - 1 \quad \forall \; i \in [W, N]$$

From the resulting series $\{R_{\text{roll}, i}\}_{i=W}^N$, the engine computes:
- **Mean (Average)**: $\mu = \frac{1}{M}\sum_{i=1}^M R_i$
- **Median**: 50th percentile of the sorted distribution.
- **Minimum (Worst-Case)**: $\min(R_i)$ — crucial for downside safety checks.
- **Maximum (Best-Case)**: $\max(R_i)$
- **Interquartile Range (IQR)**: 25th percentile ($Q_1$) and 75th percentile ($Q_3$).
- **Dispersion / Standard Deviation**: $\sigma_{\text{roll}} = \sqrt{\frac{1}{M}\sum_{i=1}^M (R_i - \mu)^2}$
- **Positive Windows Probability (%)**: $\frac{\sum \mathbb{I}(R_i > 0)}{M} \times 100\%$

### Rolling Benchmark Outperformance Hit Rate

The benchmark hit rate measures the statistical consistency of an active fund manager beating the benchmark across overlapping market regimes:

$$\text{Hit Rate} = \frac{\sum_{i=1}^M \mathbb{I}\left( R_{\text{fund}, i} > R_{\text{bench}, i} \right)}{M} \times 100\%$$

A hit rate $>70\%$ indicates high alpha consistency, while $<50\%$ flags benchmark underperformance across cycles.

### Risk-Adjusted Ratios (Sharpe & Sortino)

Daily log or arithmetic returns are computed:

$$r_t = \frac{\text{NAV}_t}{\text{NAV}_{t-1}} - 1$$

Annualized volatility is given by:

$$\sigma_p = \text{Std}(r_t) \times \sqrt{252}$$

- **Sharpe Ratio**: Measures excess return per unit of total risk against the risk-free rate $R_f$ (default: 6.50% Indian 10Y Sovereign G-Sec yield):

$$S = \frac{R_p - R_f}{\sigma_p}$$

- **Sortino Ratio**: Penalizes only downside volatility below the risk-free threshold:

$$\text{Sortino} = \frac{R_p - R_f}{\sigma_d}$$

Where downside semi-deviation $\sigma_d$ is:

$$\sigma_d = \sqrt{\frac{252}{N} \sum_{t=1}^N \min(0, r_t - r_{f, \text{daily}})^2}$$

### Capital Asset Pricing Model (Beta, Alpha, R²)

Using ordinary least squares (OLS) regression between fund excess returns $y_t = r_{p, t} - r_{f, t}$ and benchmark excess returns $x_t = r_{m, t} - r_{f, t}$:

$$\beta = \frac{\text{Cov}(r_p, r_m)}{\text{Var}(r_m)} = \frac{\sum (x_t - \bar{x})(y_t - \bar{y})}{\sum (x_t - \bar{x})^2}$$

- **Jensen's Alpha ($\alpha$)**: Annualized excess risk-adjusted return generated independent of market movements:

$$\alpha = R_p - \left[ R_f + \beta (R_m - R_f) \right]$$

- **Coefficient of Determination ($R^2$)**: Proportion of the fund's variance explained by the benchmark:

$$R^2 = \left( \frac{\text{Cov}(r_p, r_m)}{\sigma_p \sigma_m} \right)^2$$

### Active Management Metrics (Tracking Error, Information Ratio)

- **Tracking Error ($TE$)**: Volatility of excess returns over the benchmark:

$$TE = \text{Std}(r_{p, t} - r_{m, t}) \times \sqrt{252}$$

- **Information Ratio ($IR$)**: Consistency of active return generated per unit of active risk:

$$IR = \frac{R_p - R_m}{TE}$$

### Drawdowns & High-Water Mark Recovery

At any time $t$, the Peak NAV (High-Water Mark) is:

$$\text{Peak}_t = \max_{0 \le s \le t} (\text{NAV}_s)$$

The drawdown at time $t$ is:

$$DD_t = \frac{\text{NAV}_t - \text{Peak}_t}{\text{Peak}_t}$$

- **Maximum Drawdown (MDD)**:

$$MDD = \min_{t} (DD_t)$$

- **Recovery Period**: The maximum number of consecutive trading days required for the NAV to recover from trough back to a new High-Water Mark.
- **Calmar Ratio**:

$$\text{Calmar} = \frac{\text{CAGR}}{|MDD|}$$

### Capture Ratios (Upside & Downside)

Partitioning trading days into benchmark positive periods ($r_{m, t} > 0$) and benchmark negative periods ($r_{m, t} < 0$):

- **Upside Capture Ratio (UCR)**:

$$UCR = \frac{R_{p, \text{up}}}{R_{m, \text{up}}} \times 100\%$$

- **Downside Capture Ratio (DCR)**:

$$DCR = \frac{R_{p, \text{down}}}{R_{m, \text{down}}} \times 100\%$$

An optimal fund achieves $UCR > 100\%$ with $DCR < 80\%$.

---

## Portfolio Structural & Liquidity Stress Engine

### ISIN-Level Weighted Portfolio Overlap

Given two mutual funds $A$ and $B$ with constituent holdings identified by standard 12-character ISINs (`INE...`) and portfolio weights $w_{A, i}$ and $w_{B, i}$:

$$\text{Overlap}(A, B) = \sum_{i \in A \cap B} \min\left( w_{A, i}, \; w_{B, i} \right)$$

This metric ranges from $0\%$ (completely disjoint portfolios) to $100\%$ (identical holdings and allocations). The platform computes an $N \times N$ symmetric pairwise matrix across all active funds.

### Market Capitalization & Sector Concentration

- **Market Cap Look-Through**: Aggregates holdings into SEBI-defined categories:
  - **Large Cap**: Market cap > ₹20,000 Cr.
  - **Mid Cap**: Market cap ₹5,000 Cr – ₹20,000 Cr.
  - **Small Cap**: Market cap < ₹5,000 Cr.
- **Herfindahl-Hirschman Index (HHI)**: Measures sector concentration:

$$HHI = \sum_{j=1}^K s_j^2 \quad \text{where } s_j \text{ is the weight of sector } j$$

### Return Correlation & Diversification Score

Computes the Pearson correlation matrix of daily fund returns:

$$\rho_{A, B} = \frac{\text{Cov}(r_A, r_B)}{\sigma_A \sigma_B}$$

The **Portfolio Diversification Score** is calculated as:

$$\text{Diversification Score} = \left( 1 - \bar{\rho} \right) \times 100\%$$

Where $\bar{\rho}$ is the mean off-diagonal pairwise correlation. A score $>60\%$ indicates low co-movement and strong diversification benefits.

### SEBI 30-Day ADTV Liquidity Stress Testing

In accordance with SEBI guidelines for mutual funds, the stress engine estimates the liquidity horizon of equity and debt schemes:
1. Calculates each holding's **30-Day Average Daily Trading Volume (ADTV)** in Crores INR.
2. Applies a regulatory participation rate constraint $\lambda$ (configurable, default $10\% = 0.10$).
3. Computes the maximum daily liquidatable amount for stock $i$:

$$L_i = \lambda \times \text{ADTV}_i$$

4. For a redemption shock $\theta \in \{25\%, 50\%\}$ of fund AUM:
   - **Pro-Rata Liquidation**: Liquidates all holdings proportionately to maintain portfolio weights. Days to liquidate is dictated by the slowest constituent:

$$\text{Days}_{\text{Pro-Rata}}(\theta) = \max_{i} \left( \frac{\theta \times \text{AUM} \times w_i}{L_i} \right)$$

   - **Waterfall Liquidation**: Liquidates the most liquid assets first:

$$\text{Days}_{\text{Waterfall}}(\theta) = \min \left\{ d \;\middle|\; \sum_{t=1}^d \sum_i \min\left( \text{Holding Value}_i, \; t \cdot L_i \right) \ge \theta \times \text{AUM} \right\}$$

### Debt Modified Duration & Convexity Sensitivity

For fixed-income and corporate bond funds:
- **Macaulay Duration ($D_{\text{mac}}$)**: Weighted average maturity of cash flows.
- **Modified Duration ($D_{\text{mod}}$)**:

$$D_{\text{mod}} = \frac{D_{\text{mac}}}{1 + \frac{YTM}{m}}$$

- **Convexity ($C$)**: Second derivative of bond price with respect to yield.
- **Taylor Series Price Shock Model**: For an interest rate yield curve shock $\Delta y$ (in bps):

$$\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y + \frac{1}{2} C \cdot (\Delta y)^2$$

Simulated NAV is computed across $\pm 25$ bps, $\pm 50$ bps, $\pm 100$ bps, and $\pm 200$ bps parallel shifts.

---

## Modular Python Architecture (`streamlit` Suite)

The repository provides five production-ready Python modules in the root directory:

```
├── data_loader.py       # AMFI mfapi.in & yfinance ingestion, SQLite in-memory caching
├── quant_engine.py      # Vectorized NumPy/Pandas CAGR, rolling stats, alpha, beta, ratios
├── overlap_engine.py    # ISIN-level weighted overlap, HHI, market-cap & sector aggregation
├── stress_test.py       # SEBI ADTV liquidity liquidation & duration convexity modeling
├── app.py               # Interactive Streamlit dashboard with Plotly charts
└── requirements.txt     # Python dependencies
```

### Module Responsibilities

1. **`data_loader.py`**:
   - `fetch_mf_nav(scheme_code)`: Cached (`@st.cache_data`) HTTP retrieval of daily historical NAVs from `mfapi.in`.
   - `fetch_benchmark_series(symbol, period)`: Benchmark price series ingestion via `yfinance`.
   - `init_memory_db()` & `store_and_align_series()`: In-memory SQLite (`:memory:`) normalization, inner date alignment, and forward-filling of market holidays.

2. **`quant_engine.py`**:
   - Vectorized functions: `compute_cagr()`, `compute_rolling_returns()`, `compute_benchmark_hit_rate()`, `compute_risk_ratios()`, `compute_drawdowns()`, `compute_capm_metrics()`.

3. **`overlap_engine.py`**:
   - `compute_isin_overlap(holdings_a, holdings_b)`
   - `compute_overlap_matrix(funds_dict)`
   - `lookthrough_marketcap_exposure()`
   - `lookthrough_sector_exposure()`

4. **`stress_test.py`**:
   - `calculate_days_to_liquidate(portfolio_aum, holdings, adtv_pct, shock_pct)`
   - `calculate_duration_sensitivity(mac_duration, ytm, convexity, rate_shocks_bps)`

5. **`app.py`**:
   - Full Streamlit interface organizing the above into 5 interactive tabs with Plotly dark-theme visualizers.

---

## Web Quant Terminal Features & UI Architecture

### Global Fund Search & AMFI Explorer (`Cmd+K`)
- Instant modal triggered anywhere via keyboard shortcut `Cmd+K` or `Ctrl+K`.
- Live query against AMFI master records and categorized preset funds.
- Filter pills by asset class: **All**, **Flexi Cap**, **Large Cap**, **Mid Cap**, **Small Cap**, **Corporate Bond**, **Hybrid**, **Gold**, **International FoF**.
- Dynamic scheme code input for fetching any live Indian mutual fund not in presets.

### Dynamic Active Comparison Strip
- Horizontal chip bar displaying active funds with asset class badges (Debt, Hybrid, Equity).
- Seamless **One-Click Add / Remove** buttons.
- Real-time indicator showing active Benchmark, Sovereign Risk-Free Rate ($R_f$), and ADTV Limit.

### Adaptive Multi-Horizon Analysis & Resilient `N/A` Handling
- Sidebar duration selector featuring 8 standard financial horizons:
  `3M`, `6M`, `1Y`, `3Y`, `5Y`, `7Y`, `10Y`, and `Max (12Y)`.
- When an analysis horizon is clicked, the cumulative performance chart automatically slices and rebases to 100 at that exact historical start date.
- For comparisons where one fund has only 3 years of trading data while others have 10 years, all metric tables and hit rate bars display clear, professional `N/A` indicators rather than failing, breaking layout, or displaying artificial zeroes.

### Fund Factsheets & Qualitative Dossiers
- Detailed profile tab and modal inspecting:
  - **Fund Overview**: Inception date, AUM (₹ Cr), Direct & Regular TER, Turnover Ratio, SEBI Riskometer level, Minimum SIP and Lumpsum limits, Exit Load structure.
  - **Management Dossier**: Lead portfolio manager name, tenure with fund, total industry experience, educational credentials, and investment philosophy.
  - **Credit Quality (Debt Schemes)**: SOV (Sovereign G-Secs), AAA, AA+, AA, and Cash equivalents distribution.

### SIP Wealth Simulator
- Monthly Rupee Cost Averaging simulation calculating total invested capital, final corpus value, and wealth multiplier ($x$).
- Interactive slider adjusting monthly contributions from ₹1,000 to ₹100,000.
- High-resolution SVG area chart comparing cumulative investment against portfolio market value over time.

### Dynamic Export Engine & Timestamped Naming Conventions
- Export comparison data and individual factsheets in clean **CSV** and structured **JSON** formats.
- **Smart, descriptive file naming convention**:
  - Single Fund: `MF_[FundName]_[YYYY-MM-DD_HH-mm-ss].[ext]`
  - Two Funds: `MF_[FundA]_vs_[FundB]_[YYYY-MM-DD_HH-mm-ss].[ext]`
  - Multiple Funds: `MF_Portfolio_[N]_Funds_[LeadFund]_[YYYY-MM-DD_HH-mm-ss].[ext]`
- Export files contain complete, exhaustive metrics:
  - Trailing Returns: 3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y
  - Risk & Alpha Ratios: Volatility, Sharpe, Sortino, Beta, Alpha, $R^2$, Tracking Error, Information Ratio, Max Drawdown, Recovery Days, Calmar, Capture Ratios
  - 1Y, 3Y, 5Y, and 7Y Rolling Return Distributions: Mean, Median, Min, Max, 25th %ile, 75th %ile, Std Dev, % Positive Windows
  - 1Y, 3Y, 5Y, and 7Y Benchmark Hit Rates (%)
  - Full portfolio holding breakdown with ISIN, sector, market cap, weight, and 30D ADTV.

---

## Local Installation & Execution Guide

### Running the Python Streamlit Suite

1. **Clone the repository and enter the directory**:
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. **Create a Python virtual environment (Python 3.10+)**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Streamlit dashboard**:
   ```bash
   streamlit run app.py
   ```
   The dashboard will automatically open in your default browser at `http://localhost:8501`.

### Running the Web Quant Terminal (React / Vite)

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```
   Access the terminal at `http://localhost:3000`.

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## Data Pipeline & Ingestion Reliability

### Complete `api.mfapi.in` REST Endpoints Specification

The platform actively leverages the full suite of AMFI endpoints provided by `https://api.mfapi.in`:

1. **`GET /mf/search?q={query}` — Live Full-Text Scheme Search**:
   - Performs rapid sub-string and token searches across the entire Indian mutual fund universe (~38,038 schemes).
   - Returns lightweight arrays of `{ "schemeCode": int, "schemeName": string }` ideal for debounced autocomplete inputs.
   - Example: `https://api.mfapi.in/mf/search?q=HDFC`

2. **`GET /mf?limit={limit}&offset={offset}` — Universal Scheme Directory with Server Pagination**:
   - Supports paginated browsing of the master AMFI catalog.
   - Returns `{ "schemeCode": int, "schemeName": string, "isinGrowth": string, "isinDivReinvestment": string }`.
   - Allows users to explore all 38,000+ funds page-by-page.
   - Example: `https://api.mfapi.in/mf?limit=50&offset=100`

3. **`GET /mf/{scheme_code}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — Full Historical NAV Series**:
   - Delivers the complete day-by-day historical Net Asset Value (NAV) curve from fund inception to current date.
   - Includes scheme metadata (`fund_house`, `scheme_type`, `scheme_category`, `isin_growth`).
   - Supports date windowing parameters (`startDate`, `endDate`).
   - Example: `https://api.mfapi.in/mf/122639`

4. **`GET /mf/{scheme_code}/latest` — Instant Latest NAV & Metadata Preview**:
   - Ultra-fast endpoint returning only the most recent NAV, date, and scheme metadata without downloading full multi-year series.
   - Powers the real-time scheme preview dossier in the search modal before the user commits to adding it.
   - Example: `https://api.mfapi.in/mf/122639/latest`

5. **`GET /mf/latest` — Bulk Latest NAVs**:
   - Retrieves daily closing NAVs for all active schemes.

### Institutional Data Authenticity & Audit Compliance

The platform implements rigorous institutional data validation standards to eliminate discrepancies and empirical artifacts:

1. **Strict Zero-Synthetic Policy**:
   - Fabricated or synthetic price generators (such as Geometric Brownian Motion random-walk fallbacks) are **strictly disabled** across both the Web quant terminal and Python analytics suite.
   - If an AMFI endpoint is unreachable or a scheme code does not exist, the system logs an explicit error state and flags data as unavailable. Data is either 100% genuine or flagged as missing.

2. **Authentic Total Returns Index (TRI) Benchmarks**:
   - In accordance with SEBI mutual fund benchmarking regulations, funds are evaluated strictly against Total Returns Index (TRI) series (`Nifty 500 TRI`, `Nifty 50 TRI`, `Nifty Midcap 150 TRI`, `Nifty Smallcap 250 TRI`, `CRISIL Composite Bond Index`, and `Domestic Gold Spot`).
   - Benchmarks are synchronized on official Indian National Stock Exchange (NSE) business trading calendars: **strictly zero weekend rows** (no Saturdays or Sundays) and accurate national exchange holiday exclusions.
   - Benchmark levels reflect audited closing values (e.g., Nifty 500 TRI closing at 62,060.55 on 5 Nov 2026 and 62,693.58 on 6 Nov 2026, representing a +1.0202% daily movement).

3. **Synchronous Inner-Join Regression Pipeline**:
   - Risk and active management statistics (Beta, Jensen's Alpha, $R^2$, Tracking Error, Information Ratio) are computed on the strict inner intersection of matching business dates: $\text{Date}_t \in \text{Dates}_{\text{Fund}} \cap \text{Dates}_{\text{Benchmark}}$.
   - This eliminates random-walk noise and restores mathematically sound, empirically verifiable CAPM metrics (e.g. Parag Parikh Flexi Cap Beta ~0.60–0.72 and $R^2 \sim 0.55–0.75$).

4. **Official Dated AMC Factsheet Disclosures**:
   - Preset flagship funds are synchronized with official September 2026 published AMC factsheet disclosures:
     - **Parag Parikh Flexi Cap Fund (122639)**: AUM of **₹1,45,070.50 Crore**, lead manager Rajeev Thakkar (13.5 years tenure), and verified holdings including ITC Ltd (`INE154A01025`), Power Grid (`INE745G01035`), Coal India (`INE522F01014`), and Bajaj Holdings (`INE118A01012`).
     - **Motilal Oswal Midcap Fund (127042)**: AUM of **₹42,851.59 Crore**, lead manager Niket Shah (8.6 years tenure), and verified holdings including One 97 Communications / Paytm (`INE982J01020`), Kalyan Jewellers (`INE303R01014`), and Zomato / Eternal (`INE484J01027`).
     - **HDFC Top 100 (118989)**: AUM of ₹43,250 Crore, manager Rahul Baijal (2.4 years tenure).
     - **Nippon India Small Cap (118778)**: AUM of ₹63,800 Crore, manager Samir Rachh (7.8 years tenure).
     - **SBI Bluechip (119598)**: AUM of ₹52,400 Crore, manager Saurabh Pant (4.1 years tenure).
     - **ICICI Prudential Corporate Bond (120503)**: AUM of ₹31,500 Crore, Modified Duration ~3.58Y, YTM 7.55%.
     - **ICICI Prudential Balanced Advantage (120586)**: AUM of ₹65,200 Crore.
     - **Nippon India Gold Savings (118753)**: AUM of ₹8,200 Crore.
     - **Motilal Oswal Nasdaq 100 FoF (145552)**: AUM of ₹6,400 Crore.

5. **Cash-Excluded Stock Overlap Engine**:
   - Liquidity instruments (`CASH_EQUIV`, `TREPS`, cash collateral, and money market reserves) are universally filtered out of stock-level portfolio overlap calculations.
   - Overlap scores quantify true common corporate equity holdings across funds without artificial inflation from cash buffers.

6. **Descriptive Filename & Complete Export Formatting**:
   - Export filenames dynamically format as `<FundName>_<YYYYMMDD_HHMMSS>_<ReportType>.<ext>` or `Comparison_<Fund1>_vs_<Fund2>_<YYYYMMDD_HHMMSS>_<ReportType>.<ext>`.
   - Export payloads include full 1Y, 3Y, 5Y, and 7Y rolling return distributions (Mean, Median, Min, Max, 25th/75th Percentiles, Std Dev), Rolling Benchmark Hit Rates (%), and complete unsampled daily NAV time-series with provenance headers.

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
