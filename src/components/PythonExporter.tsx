import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal, AlertTriangle } from 'lucide-react';

interface FileDefinition {
  name: string;
  moduleName: string;
  description: string;
  code: string;
}

export const PYTHON_MODULES: FileDefinition[] = [
  {
    name: 'data_loader.py',
    moduleName: 'Module 1: Ingestion Pipeline (Legacy Audit Quarantine)',
    description: 'Dynamic NAV ingestion from api.mfapi.in, yfinance benchmark series, and in-memory SQLite schema normalization.',
    code: `"""
Module 1: Data Ingestion & In-Memory Caching (data_loader.py)
Fetches mutual fund NAVs from api.mfapi.in and benchmark series from yfinance.
Normalizes and stores series in an in-memory SQLite database.
"""

from datetime import datetime, timedelta
import logging
import sqlite3
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import requests

try:
    import streamlit as st
    cache_decorator = st.cache_data(ttl=3600)
except Exception:
    def cache_decorator(func):
        return func

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PRESET_FUNDS: Dict[str, Dict[str, Any]] = {
    "122639": {"scheme_code": 122639, "name": "Parag Parikh Flexi Cap Fund", "category": "Flexi Cap", "benchmark": "^CRSLDX", "isin": "INF879O01027", "aum_cr": 72500.0, "macaulay_duration": 0.0},
    "127042": {"scheme_code": 127042, "name": "Motilal Oswal Midcap Fund", "category": "Mid Cap", "benchmark": "NIFTYMIDCAP150.NS", "isin": "INF247L01646", "aum_cr": 18200.0, "macaulay_duration": 0.0},
    "118989": {"scheme_code": 118989, "name": "HDFC Top 100 Large Cap Fund", "category": "Large Cap", "benchmark": "^NSEI", "isin": "INF179K01BE2", "aum_cr": 36400.0, "macaulay_duration": 0.0},
    "118778": {"scheme_code": 118778, "name": "Nippon India Small Cap Fund", "category": "Small Cap", "benchmark": "^CRSLDX", "isin": "INF204K01726", "aum_cr": 58600.0, "macaulay_duration": 0.0},
    "119598": {"scheme_code": 119598, "name": "SBI Bluechip Large Cap Fund", "category": "Large Cap", "benchmark": "^NSEI", "isin": "INF200K01135", "aum_cr": 49100.0, "macaulay_duration": 0.0},
    "120503": {"scheme_code": 120503, "name": "ICICI Prudential Corporate Bond Fund", "category": "Corporate Bond", "benchmark": "^NSEI", "isin": "INF109K01AQ5", "aum_cr": 26800.0, "macaulay_duration": 3.85, "ytm": 0.0745},
}

BENCHMARK_SYMBOLS = {
    "^NSEI": "Nifty 50",
    "^CRSLDX": "Nifty 500",
    "NIFTYMIDCAP150.NS": "Nifty Midcap 150",
}

@cache_decorator
def search_mfapi_schemes(query: str):
    """Search mutual fund schemes by name using api.mfapi.in/mf/search."""
    if not query or len(query.strip()) < 2:
        return []
    url = f"https://api.mfapi.in/mf/search?q={requests.utils.quote(query.strip())}"
    try:
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"mfapi search failed: {e}")
    return []

@cache_decorator
def fetch_mfapi_catalog(limit: int = 50, offset: int = 0):
    """List mutual fund schemes with pagination from api.mfapi.in/mf."""
    url = f"https://api.mfapi.in/mf?limit={limit}&offset={offset}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"mfapi catalog failed: {e}")
    return []

@cache_decorator
def fetch_fund_nav_mfapi(scheme_code: int or str) -> pd.DataFrame:
    code_str = str(scheme_code).strip()
    url = f"https://api.mfapi.in/mf/{code_str}"
    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code == 200:
            payload = resp.json()
            data = payload.get("data", [])
            if data:
                df = pd.DataFrame(data)
                df["date"] = pd.to_datetime(df["date"], format="%d-%m-%Y", errors="coerce")
                df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
                df = df.dropna(subset=["date", "nav"]).sort_values("date").reset_index(drop=True)
                df["scheme_code"] = int(code_str)
                return df[["scheme_code", "date", "nav"]].drop_duplicates(subset=["date"])
    except Exception as e:
        logger.warning(f"Live fetch failed for scheme {scheme_code}: {e}")
    return _generate_calibrated_fund_series(int(code_str))

def _generate_calibrated_fund_series(scheme_code: int) -> pd.DataFrame:
    np.random.seed(scheme_code % 10000)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365 * 10)
    dates = pd.bdate_range(start=start_date, end=end_date)
    cagr_map = {122639: 0.185, 127042: 0.22, 118989: 0.15, 118778: 0.24, 119598: 0.145, 120503: 0.076}
    vol_map = {122639: 0.13, 127042: 0.17, 118989: 0.14, 118778: 0.20, 119598: 0.135, 120503: 0.025}
    mu = cagr_map.get(scheme_code, 0.15)
    sigma = vol_map.get(scheme_code, 0.15)
    dt = 1.0 / 252.0
    daily_returns = np.random.normal((mu - 0.5 * sigma**2) * dt, sigma * np.sqrt(dt), len(dates))
    base_nav = 10.0 if scheme_code != 120503 else 25.0
    nav_series = base_nav * np.exp(np.cumsum(daily_returns))
    return pd.DataFrame({"scheme_code": scheme_code, "date": dates, "nav": nav_series})

@cache_decorator
def fetch_benchmark_series(symbol: str = "^NSEI", start_date: Optional[str] = None) -> pd.DataFrame:
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        start = start_date or (datetime.now() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
        hist = ticker.history(start=start, auto_adjust=True)
        if not hist.empty:
            df = hist.reset_index()
            df["date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
            df["close"] = df["Close"].astype(float)
            df["symbol"] = symbol
            return df[["symbol", "date", "close"]].sort_values("date").reset_index(drop=True)
    except Exception as e:
        logger.warning(f"yfinance fetch failed for {symbol}: {e}")
    return _generate_calibrated_benchmark_series(symbol)

def _generate_calibrated_benchmark_series(symbol: str) -> pd.DataFrame:
    seed_map = {"^NSEI": 42, "^CRSLDX": 500, "NIFTYMIDCAP150.NS": 150}
    np.random.seed(seed_map.get(symbol, 101))
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365 * 10)
    dates = pd.bdate_range(start=start_date, end=end_date)
    params = {"^NSEI": (0.135, 0.15, 6000.0), "^CRSLDX": (0.145, 0.155, 4500.0), "NIFTYMIDCAP150.NS": (0.19, 0.19, 3200.0)}
    mu, sigma, base_price = params.get(symbol, (0.14, 0.15, 5000.0))
    dt = 1.0 / 252.0
    daily_returns = np.random.normal((mu - 0.5 * sigma**2) * dt, sigma * np.sqrt(dt), len(dates))
    price_series = base_price * np.exp(np.cumsum(daily_returns))
    return pd.DataFrame({"symbol": symbol, "date": dates, "close": price_series})

class InMemoryNAVStore:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self._init_schema()

    def _init_schema(self):
        cur = self.conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS fund_nav (scheme_code INTEGER, date TEXT, nav REAL, PRIMARY KEY (scheme_code, date))")
        cur.execute("CREATE TABLE IF NOT EXISTS benchmark_nav (symbol TEXT, date TEXT, close REAL, PRIMARY KEY (symbol, date))")
        self.conn.commit()

    def store_fund_nav(self, df: pd.DataFrame):
        if not df.empty:
            records = df.copy()
            records["date"] = records["date"].dt.strftime("%Y-%m-%d")
            records.to_sql("fund_nav", self.conn, if_exists="append", index=False)
            self.conn.commit()

    def store_benchmark(self, df: pd.DataFrame):
        if not df.empty:
            records = df.copy()
            records["date"] = records["date"].dt.strftime("%Y-%m-%d")
            records.to_sql("benchmark_nav", self.conn, if_exists="append", index=False)
            self.conn.commit()

    def get_aligned_data(self, scheme_codes: List[int or str], benchmark_symbol: str, start_date: Optional[str] = None) -> pd.DataFrame:
        code_ints = [int(c) for c in scheme_codes]
        codes_ph = ",".join("?" for _ in code_ints)
        q_fund = f"SELECT date, scheme_code, nav FROM fund_nav WHERE scheme_code IN ({codes_ph})"
        params = list(code_ints)
        if start_date:
            q_fund += " AND date >= ?"
            params.append(start_date)
        funds_df = pd.read_sql_query(q_fund, self.conn, params=params)
        q_bench = "SELECT date, close as benchmark_close FROM benchmark_nav WHERE symbol = ?"
        bench_params = [benchmark_symbol]
        if start_date:
            q_bench += " AND date >= ?"
            bench_params.append(start_date)
        bench_df = pd.read_sql_query(q_bench, self.conn, params=bench_params)
        if funds_df.empty or bench_df.empty:
            return pd.DataFrame()
        pivoted = funds_df.pivot(index="date", columns="scheme_code", values="nav")
        bench_df = bench_df.set_index("date")
        merged = pivoted.join(bench_df, how="outer").sort_index().ffill().bfill().dropna()
        merged.index = pd.to_datetime(merged.index)
        return merged

def get_aligned_fund_and_benchmark(scheme_codes: List[int or str], benchmark_symbol: str = "^CRSLDX", years: int = 5) -> pd.DataFrame:
    store = InMemoryNAVStore()
    for code in scheme_codes:
        store.store_fund_nav(fetch_fund_nav_mfapi(code))
    store.store_benchmark(fetch_benchmark_series(benchmark_symbol))
    start_dt = (datetime.now() - timedelta(days=int(years * 365.25))).strftime("%Y-%m-%d")
    return store.get_aligned_data(scheme_codes, benchmark_symbol, start_date=start_dt)
`,
  },
  {
    name: 'quant_engine.py',
    moduleName: 'Module 2: Quantitative Engine (Legacy Audit Quarantine)',
    description: 'Vectorized NumPy/Pandas computation of CAGR, Rolling Distributions, Hit Rates, Sharpe, Sortino, CML metrics, and Drawdowns.',
    code: `"""
Module 2: Quantitative Risk Engine (quant_engine.py)
"""
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

def compute_trailing_cagr(series: pd.Series, periods_years: List[int] = [1, 3, 5, 7]) -> Dict[str, float]:
    results = {}
    cleaned = series.dropna().sort_index()
    if len(cleaned) < 10:
        return {f"{p}Y": np.nan for p in periods_years}
    end_date = cleaned.index[-1]
    end_price = cleaned.iloc[-1]
    for years in periods_years:
        target_start = end_date - pd.DateOffset(years=years)
        sub = cleaned[cleaned.index <= target_start]
        if not sub.empty:
            cagr = (end_price / sub.iloc[-1]) ** (1.0 / years) - 1.0
            results[f"{years}Y"] = round(cagr * 100.0, 2)
        else:
            days = (end_date - cleaned.index[0]).days
            if days >= 300:
                cagr = (end_price / cleaned.iloc[0]) ** (1.0 / (days / 365.25)) - 1.0
                results[f"{years}Y"] = round(cagr * 100.0, 2)
    return results

def compute_rolling_returns(series: pd.Series, window_years: float = 3.0, trading_days_per_year: int = 252) -> pd.Series:
    window_days = int(window_years * trading_days_per_year)
    cleaned = series.dropna().sort_index()
    if len(cleaned) <= window_days:
        return pd.Series(dtype=float)
    shifted = cleaned.shift(window_days)
    return ((cleaned / shifted) ** (trading_days_per_year / window_days) - 1.0).dropna()

def compute_benchmark_hit_rate(fund_rolling: pd.Series, benchmark_rolling: pd.Series) -> float:
    aligned = pd.concat([fund_rolling.rename("fund"), benchmark_rolling.rename("bench")], axis=1).dropna()
    if aligned.empty:
        return 0.0
    return round(float((aligned["fund"] > aligned["bench"]).mean() * 100.0), 2)

def compute_risk_ratios(returns_series: pd.Series, rf_annual: float = 0.065, trading_days_per_year: int = 252) -> Dict[str, float]:
    ret = returns_series.dropna()
    if len(ret) < 20:
        return {"volatility": 0.0, "sharpe": 0.0, "sortino": 0.0, "annualized_return": 0.0}
    n_days = len(ret)
    ann_return = ((1.0 + ret).prod() ** (trading_days_per_year / n_days)) - 1.0
    ann_vol = float(ret.std() * np.sqrt(trading_days_per_year))
    excess = ann_return - rf_annual
    sharpe = float(excess / ann_vol) if ann_vol > 1e-6 else 0.0
    rf_daily = (1.0 + rf_annual) ** (1.0 / trading_days_per_year) - 1.0
    downside_dev = float(np.sqrt(np.mean(np.minimum(0.0, ret - rf_daily) ** 2)) * np.sqrt(trading_days_per_year))
    sortino = float(excess / downside_dev) if downside_dev > 1e-6 else 0.0
    return {"volatility": round(ann_vol * 100.0, 2), "annualized_return": round(ann_return * 100.0, 2), "sharpe": round(sharpe, 2), "sortino": round(sortino, 2)}

def compute_cml_metrics(fund_returns: pd.Series, benchmark_returns: pd.Series, rf_annual: float = 0.065, trading_days_per_year: int = 252) -> Dict[str, float]:
    aligned = pd.concat([fund_returns.rename("fund"), benchmark_returns.rename("bench")], axis=1).dropna()
    if len(aligned) < 30:
        return {"beta": 1.0, "alpha": 0.0, "r2": 0.0}
    cov = np.cov(aligned["fund"], aligned["bench"])
    beta = float(cov[0, 1] / cov[1, 1]) if cov[1, 1] > 1e-8 else 1.0
    n = len(aligned)
    ann_f = ((1.0 + aligned["fund"]).prod() ** (trading_days_per_year / n)) - 1.0
    ann_b = ((1.0 + aligned["bench"]).prod() ** (trading_days_per_year / n)) - 1.0
    j_alpha = float(ann_f - (rf_annual + beta * (ann_b - rf_annual)))
    r2 = float(np.corrcoef(aligned["fund"], aligned["bench"])[0, 1] ** 2)
    return {"beta": round(beta, 2), "alpha": round(j_alpha * 100.0, 2), "r2": round(r2, 3)}

def compute_active_metrics(fund_returns: pd.Series, benchmark_returns: pd.Series, trading_days_per_year: int = 252) -> Dict[str, float]:
    aligned = pd.concat([fund_returns.rename("fund"), benchmark_returns.rename("bench")], axis=1).dropna()
    diff = aligned["fund"] - aligned["bench"]
    te = float(diff.std() * np.sqrt(trading_days_per_year))
    n = len(aligned)
    ann_f = ((1.0 + aligned["fund"]).prod() ** (trading_days_per_year / n)) - 1.0
    ann_b = ((1.0 + aligned["bench"]).prod() ** (trading_days_per_year / n)) - 1.0
    ir = float((ann_f - ann_b) / te) if te > 1e-6 else 0.0
    return {"tracking_error": round(te * 100.0, 2), "information_ratio": round(ir, 2)}

def compute_drawdowns(price_series: pd.Series) -> Dict[str, Any]:
    cleaned = price_series.dropna().sort_index()
    if cleaned.empty:
        return {"max_drawdown": 0.0, "recovery_days": 0, "drawdown_series": pd.Series(dtype=float)}
    running_max = cleaned.cummax()
    dd = (cleaned - running_max) / running_max
    min_dd = float(dd.min())
    max_idx = dd.idxmin()
    peak_val = cleaned.loc[:max_idx].max()
    peak_idx = cleaned.loc[:max_idx][cleaned == peak_val].index[-1]
    recovered = cleaned.loc[max_idx:][cleaned >= peak_val]
    rec_days = (recovered.index[0] - peak_idx).days if not recovered.empty else (cleaned.index[-1] - peak_idx).days
    return {"max_drawdown": round(min_dd * 100.0, 2), "recovery_days": rec_days, "drawdown_series": dd}
`,
  },
  {
    name: 'overlap_engine.py',
    moduleName: 'Module 3: Overlap & Sector Engine (Legacy Audit Quarantine)',
    description: 'Calculates ISIN-level weighted overlap min(W_A, W_B), pairwise matrix, and look-through market-cap and sector allocations.',
    code: `"""
Module 3: In-Memory Portfolio Overlap & Sector Engine (overlap_engine.py)
"""
import pandas as pd
from typing import Any, Dict, List, Optional

def compute_pairwise_overlap(holdings_a: pd.DataFrame, holdings_b: pd.DataFrame, exclude_cash: bool = True) -> float:
    if holdings_a.empty or holdings_b.empty:
        return 0.0
    df_a = holdings_a[holdings_a["isin"] != "CASH_EQUIV"] if exclude_cash else holdings_a
    df_b = holdings_b[holdings_b["isin"] != "CASH_EQUIV"] if exclude_cash else holdings_b
    merged = pd.merge(df_a, df_b, on="isin", suffixes=("_a", "_b"))
    if merged.empty:
        return 0.0
    return round(float(merged[["weight_a", "weight_b"]].min(axis=1).sum()), 2)

def compute_overlap_matrix(scheme_codes: List[int or str], exclude_cash: bool = True) -> pd.DataFrame:
    codes_str = [str(c) for c in scheme_codes]
    matrix = pd.DataFrame(index=codes_str, columns=codes_str, dtype=float)
    return matrix
`,
  },
  {
    name: 'stress_test.py',
    moduleName: 'Module 4: Debt & Liquidity Engine (Legacy Audit Quarantine)',
    description: '30-day ADTV liquidity stress horizon (25% & 50% liquidation) and Macaulay / Modified Duration rate sensitivity shock model.',
    code: `"""
Module 4: Debt & Liquidity Stress Testing Engine (stress_test.py)
"""
import numpy as np
import pandas as pd
from typing import Any, Dict, List

def calculate_liquidity_stress(holdings_df: pd.DataFrame, aum_crores: float = 25000.0, participation_rate: float = 0.10) -> Dict[str, Any]:
    df = holdings_df.copy()
    df["position_cr"] = (df["weight"] / 100.0) * aum_crores
    df["daily_absorbable_cr"] = df["adtv_cr"] * participation_rate
    df["days_to_liquidate_100pct"] = np.where(df["isin"] == "CASH_EQUIV", 0.0, df["position_cr"] / np.maximum(df["daily_absorbable_cr"], 0.1))

    days_25_prorata = float(df[df["isin"] != "CASH_EQUIV"]["days_to_liquidate_100pct"].max() * 0.25)
    days_50_prorata = float(df[df["isin"] != "CASH_EQUIV"]["days_to_liquidate_100pct"].max() * 0.50)

    sorted_df = df.sort_values("days_to_liquidate_100pct", ascending=True)
    sorted_df["cum_weight"] = sorted_df["weight"].cumsum()
    days_25_wf = float(sorted_df[sorted_df["cum_weight"] <= 25.0]["days_to_liquidate_100pct"].max())
    days_50_wf = float(sorted_df[sorted_df["cum_weight"] <= 50.0]["days_to_liquidate_100pct"].max())

    return {
        "days_25_prorata": round(days_25_prorata, 1),
        "days_50_prorata": round(days_50_prorata, 1),
        "days_25_waterfall": round(days_25_wf, 1),
        "days_50_waterfall": round(days_50_wf, 1)
    }

def calculate_duration_sensitivity(macaulay_duration: float = 3.85, current_ytm: float = 0.0745, convexity: float = 24.5, shock_bps_list: List[int] = [-200, -100, -50, 0, 50, 100, 200], base_nav: float = 100.0) -> pd.DataFrame:
    mod_dur = macaulay_duration / (1.0 + current_ytm)
    rows = []
    for bps in shock_bps_list:
        dy = bps / 10000.0
        dur_effect = -mod_dur * dy
        cvx_effect = 0.5 * convexity * (dy ** 2)
        tot = dur_effect + cvx_effect
        rows.append({"shock_bps": bps, "total_nav_change_pct": round(tot * 100.0, 2), "simulated_nav": round(base_nav * (1.0 + tot), 2)})
    return pd.DataFrame(rows)
`,
  },
  {
    name: 'app.py',
    moduleName: 'Module 5: Streamlit Frontend (Legacy Audit Quarantine)',
    description: 'Streamlit dashboard entry point pending Batch 3 canonical restoration.',
    code: `"""
Module 5: Streamlit Frontend & Visualizations (app.py)
Run with: streamlit run app.py
"""
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from data_loader import PRESET_FUNDS, BENCHMARK_SYMBOLS, get_aligned_fund_and_benchmark
from quant_engine import compute_trailing_cagr, compute_rolling_returns, compute_risk_ratios
from overlap_engine import compute_overlap_matrix, aggregate_market_cap_exposure, aggregate_sector_exposure
from stress_test import calculate_liquidity_stress, calculate_duration_sensitivity
`,
  },
  {
    name: 'requirements.txt',
    moduleName: 'Dependencies',
    description: 'Python package dependencies for running locally.',
    code: `streamlit>=1.35.0
plotly>=5.22.0
pandas>=2.2.0
numpy>=1.26.0
requests>=2.31.0
yfinance>=0.2.40
scipy>=1.13.0
`,
  },
];

export const PythonExporter: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>(PYTHON_MODULES[0].name);
  const [copied, setCopied] = useState<boolean>(false);

  const currentMod = PYTHON_MODULES.find((m) => m.name === activeFile) || PYTHON_MODULES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMod.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    PYTHON_MODULES.forEach((m) => {
      handleDownload(m.name, m.code);
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Audit Status Quarantine Banner (Batch 1 Item 6) */}
      <div className="p-4 bg-rose-950/80 border-b border-rose-800/80 flex items-start gap-3 text-xs text-rose-100">
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-rose-200 uppercase tracking-wider text-[11px]">
            Audit Quarantine Notice — Legacy Python Suite Pending Batch 3 Remediation
          </div>
          <p className="text-rose-200/90 leading-relaxed">
            The legacy Python modules exposed below have <span className="font-semibold">known build and data failures</span> identified during audit (including <code className="font-mono text-rose-300">MF-002</code> scheme mismatches, <code className="font-mono text-rose-300">MF-004</code> root <code className="font-mono">data_loader.py</code> syntax failure, <code className="font-mono text-rose-300">MF-005</code> synthetic random-walk NAV/benchmark fallbacks, and <code className="font-mono text-rose-300">MF-016</code> forward/backfill distortion). Python remediation and synchronized archive generation are scheduled for <span className="font-semibold">Batch 3</span>. Do not use outputs from this legacy download for investment decisions.
          </p>
        </div>
      </div>

      {/* Module Navigation Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Legacy Python Streamlit Suite (Pre-Batch 3)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Archival 5-module snapshot preserved for reference until Batch 3 canonical Python restoration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Legacy Module'}
          </button>

          <button
            onClick={() => handleDownload(currentMod.name, currentMod.code)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/60 text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Legacy {currentMod.name}
          </button>

          <button
            onClick={handleDownloadAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-700/60 text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Legacy Archive
          </button>
        </div>
      </div>

      {/* File Selector Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto text-xs">
        {PYTHON_MODULES.map((mod) => (
          <button
            key={mod.name}
            onClick={() => setActiveFile(mod.name)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono transition-colors whitespace-nowrap ${
              activeFile === mod.name
                ? 'bg-slate-800 text-amber-300 border border-slate-700 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{mod.name}</span>
          </button>
        ))}
      </div>

      {/* Module Overview Banner */}
      <div className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div>
          <span className="font-semibold text-slate-200">{currentMod.moduleName}: </span>
          <span>{currentMod.description}</span>
        </div>
        <div className="font-mono text-slate-500 text-[11px]">
          {currentMod.code.split('\n').length} lines · UTF-8
        </div>
      </div>

      {/* Code Display Area */}
      <div className="p-4 bg-slate-950 max-h-[540px] overflow-y-auto">
        <pre className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto selection:bg-indigo-900">
          <code>{currentMod.code}</code>
        </pre>
      </div>
    </div>
  );
};
