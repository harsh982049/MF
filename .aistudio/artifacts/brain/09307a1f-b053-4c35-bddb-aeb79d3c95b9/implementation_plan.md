# Full MFAPI Universe Integration (38,000+ Indian Mutual Funds)

Transform the Indian Mutual Funds Quantitative Studio from a curated preset list into an open institutional universe explorer powered by the complete suite of `https://api.mfapi.in` endpoints (`/mf/search`, `/mf` with pagination, `/mf/{scheme_code}`, and `/mf/{scheme_code}/latest`). Any of the 38,000+ mutual fund schemes in India can now be discovered, previewed, added to comparisons, and analyzed across all quantitative and structural engines.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed via user preferences:
> - **Search & Browsing Interface**: Live debounced search via `/mf/search?q={query}` combined with server-paginated browsing (`/mf?limit=50&offset={offset}`) over the entire 38,000+ fund directory.
> - **Holdings & Sector Synthesis**: Newly added funds from the universe will automatically have benchmark-aligned representative holdings and sector weightings synthesized based on their official AMFI `scheme_category` (e.g., Large Cap, Mid Cap, Flexi Cap, Small Cap, Corporate Bond, Hybrid, Gold, etc.).
> - **Benchmark Mapping**: Every added fund will automatically be mapped to its native benchmark index (`^NSEI` Nifty 50, `^CRSLDX` Nifty 500, `NIFTY_MIDCAP_150.NS` Nifty Midcap 150) based on its category, while also supporting cross-benchmark comparison against the dashboard's active benchmark.

---

### 1. Overview & Core Concept

- **What It Does**: Unlocks unconstrained mutual fund analytics across the entire Indian market (~38,038 live schemes). Users can search by AMC name, scheme name, or scheme code, browse paginated listings across categories, view instant scheme metadata and latest NAVs via `/mf/{scheme_code}/latest`, and seamlessly load full multi-year NAV series via `/mf/{scheme_code}` into the rolling returns, CAPM alpha/beta, drawdown, SIP, and stress-testing engines.
- **Target Audience / Persona**: Quant researchers, financial advisors, wealth managers, and individual investors analyzing any active or historical Indian mutual fund scheme without artificial universe restrictions.
- **Key Value**: Eradicates the limitation of fixed fund presets. Users can analyze any fund from HDFC, SBI, ICICI Prudential, Nippon India, Parag Parikh, Quant, Mirae Asset, Axis, Kotak, DSP, Tata, or any other AMC in existence.

---

### 2. User Experience & Visual Design

#### A. Global Fund Search & Universe Explorer Modal (`FundSearchModal.tsx`)
- **Dual Mode Exploration**:
  1. **Live Search Tab (`/mf/search?q={query}`)**:
     - Instant 300ms debounced search sending live queries to `https://api.mfapi.in/mf/search?q={query}`.
     - Displays match count, scheme code badge, fund house tag, and quick-add actions.
     - Search highlight matching query tokens in scheme names.
  2. **Universe Directory Tab (`/mf?limit=50&offset={offset}`)**:
     - Paginated browsing across all 38,000+ mutual funds.
     - Controls: "Previous 50", "Next 50", jump to offset, and total count indicator (`Displaying 1–50 of 38,038 schemes`).
- **Category & Plan Filter Chips**:
  - Filter quick-toggles for: **All**, **Direct Plans**, **Regular Plans**, **Growth**, **IDCW/Dividend**, **Equity**, **Debt**, **Hybrid**, **Index / ETF**.
- **Instant Scheme Quick-Inspect**:
  - Hover or click to inspect latest NAV, latest date, fund house, and scheme category using `GET /mf/{scheme_code}/latest`.
  - "Add to Comparison" button with immediate visual feedback (added state indicator).

#### B. Dynamic Fund Onboarding in Dashboard (`App.tsx`)
- When any scheme is added:
  1. The app fetches `GET /mf/{scheme_code}/latest` (or full `/mf/{scheme_code}`) to extract:
     - Scheme name, scheme code, fund house, AMFI category, ISIN growth.
  2. The categorization engine infers:
     - Asset Class (`Equity`, `Debt`, `Hybrid`, `Gold`, `Commodity`).
     - Target Benchmark (`Nifty 50`, `Nifty 500`, `Nifty Midcap 150`).
     - Representative portfolio holdings based on category parameters.
  3. The time-series loader fetches the complete historical NAV curve from `GET /mf/{scheme_code}` and feeds it directly into:
     - Cumulative rebased performance chart.
     - Trailing returns matrix (3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y).
     - Rolling return distributions and benchmark hit rates.
     - Risk ratios (Sharpe, Sortino, Beta, Alpha, Tracking Error, Drawdowns).
     - Factsheet dossier and SIP simulator.

#### C. Python Streamlit Suite Update (`data_loader.py` & `app.py`)
- Expose `search_mutual_funds(query)` and `fetch_all_schemes(limit, offset)` in `data_loader.py`.
- Update `app.py` sidebar to feature live search input querying `https://api.mfapi.in/mf/search` so local Python users can also search and add any mutual fund from the 38,000+ universe.

---

### 3. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MFAPI.IN REST API LAYER                         │
│  /mf/search?q=...  │  /mf?limit=..&offset=..  │  /mf/{code}  │ /mf/{code}/latest │
└───────────────────┬───────────────────────────┬──────────────┬─────────┘
                    │                           │              │
                    ▼                           ▼              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   IN-MEMORY CLIENT & CACHING LAYER                     │
│  - Scheme Metadata Cache (sessionStorage / in-memory Map)              │
│  - Time-Series Store (NavPoint[] indexed by scheme_code)               │
│  - Category-to-AssetClass & Benchmark Classifier                       │
│  - Synthetic Portfolio Holdings Generator                              │
└───────────────────┬────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     REACT USER INTERFACE (PORT 3000)                   │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ FundSearchModal.tsx   │  │ Comparison Strip (App.tsx)            │  │
│  │ - /mf/search (live)   │  │ - Active fund chips                   │  │
│  │ - /mf (paginated)     │  │ - Quick remove / add                  │  │
│  │ - Category filters    │  │ - Universal scheme ingestion          │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Visualizers & Engines (Quant, Overlap, Stress, SIP, Factsheets)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Implementation Steps

1. **Step 1: AMFI Category & Benchmark Inference Engine (`src/utils/mfapiClassifier.ts`)**
   - Create helper utility to parse `scheme_category` (e.g., `"Equity Scheme - Mid Cap Fund"`, `"Debt Scheme - Banking and PSU Fund"`, `"Hybrid Scheme - Dynamic Asset Allocation"`) and extract:
     - `asset_class`: `'Equity' | 'Debt' | 'Hybrid' | 'Gold' | 'Commodity'`
     - `benchmark_symbol`: `'^NSEI' | '^CRSLDX' | 'NIFTY_MIDCAP_150.NS'`
     - `market_cap_focus`: `'Large' | 'Mid' | 'Small' | 'Multi'`
     - `synthesized_holdings`: Representative look-through holdings aligned with the asset class and capitalization profile.

2. **Step 2: Enhanced Fund Search Modal (`src/components/FundSearchModal.tsx`)**
   - Implement live debounced querying against `https://api.mfapi.in/mf/search?q={query}`.
   - Implement paginated directory browsing against `https://api.mfapi.in/mf?limit=50&offset={offset}` with Next/Prev pagination controls.
   - Add filter tabs: All, Direct Plan, Regular, Growth, IDCW, Equity, Debt, Hybrid.
   - Add instant scheme preview card showing latest NAV, date, fund house, and category from `/mf/{code}/latest`.

3. **Step 3: Universal Scheme Ingestion in `src/App.tsx` & `src/data/presetFunds.ts`**
   - Upgrade `handleAddCustomScheme` and `fetchLiveMfNav`:
     - Load full historical data from `https://api.mfapi.in/mf/{scheme_code}`.
     - Seamlessly construct the complete `FundMeta` object with live metadata, inferred category, manager profile, and synthesized holdings.
     - Store in `customFunds` state so any added fund seamlessly flows into all 6 dashboard tabs (Performance, Risk, Overlap, Stress, SIP, Factsheets).

4. **Step 4: Update Python Streamlit Module (`data_loader.py` & `app.py`)**
   - Add `search_mfapi(query)` and `fetch_mfapi_catalog(limit, offset)` in `data_loader.py`.
   - Update `app.py` sidebar search input to query live `mfapi.in` schemes so Streamlit users can also select any fund dynamically.

5. **Step 5: Verification & Quality Assurance**
   - [x] Verified TypeScript compilation (`compile_applet`) and lint checks (`lint_applet`).
   - [x] Tested live search against `https://api.mfapi.in/mf/search?q=HDFC` and verified full-text search capability across 38,000+ schemes.
   - [x] Tested paginated catalog against `https://api.mfapi.in/mf?limit=50&offset=0` with server pagination.
   - [x] Tested scheme quick-preview card using `https://api.mfapi.in/mf/{scheme_code}/latest`.
   - [x] Tested universal ingestion in `src/App.tsx` and `src/utils/mfapiClassifier.ts` to seamlessly populate all analytical views.
   - [x] Updated modular Python Streamlit application (`data_loader.py` and `app.py`) to support universal scheme search.
   - [x] Comprehensive documentation in `README.md` covering all 5 `mfapi.in` endpoints.
