"""
Module 2: Quantitative Risk Engine (quant_engine.py)
Vectorized Pandas and NumPy functions for computing:
- Trailing & Rolling Returns (CAGR, Distributions, 3Y/5Y windows)
- Benchmark Hit Rates (% of rolling periods outperforming benchmark)
- Risk Ratios: Annualized Volatility, Sharpe, Sortino (configurable Rf)
- Capital Market Line Metrics: Beta, Jensen's Alpha, R-Squared
- Active Metrics: Tracking Error, Information Ratio, Max Drawdown & Recovery Periods
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


def compute_trailing_cagr(series: pd.Series, periods_years: List[int] = [1, 3, 5, 7]) -> Dict[str, float]:
    """
    Compute annualized Compound Annual Growth Rate (CAGR) for specific trailing calendar periods.
    Formula: CAGR = (P_end / P_start) ** (1 / years) - 1
    """
    results: Dict[str, float] = {}
    cleaned = series.dropna().sort_index()
    if len(cleaned) < 10:
        return {f"{p}Y": np.nan for p in periods_years}

    end_date = cleaned.index[-1]
    end_price = cleaned.iloc[-1]

    for years in periods_years:
        target_start_date = end_date - pd.DateOffset(years=years)
        # Find closest date on or before target_start_date
        sub = cleaned[cleaned.index <= target_start_date]
        if not sub.empty:
            start_price = sub.iloc[-1]
            cagr = (end_price / start_price) ** (1.0 / years) - 1.0
            results[f"{years}Y"] = round(cagr * 100.0, 2)
        else:
            # Fallback if fund history is shorter: annualized total return if >= 1 year
            days_available = (end_date - cleaned.index[0]).days
            if days_available >= 300:
                years_avail = days_available / 365.25
                cagr = (end_price / cleaned.iloc[0]) ** (1.0 / years_avail) - 1.0
                results[f"{years}Y"] = round(cagr * 100.0, 2)
            else:
                results[f"{years}Y"] = np.nan

    return results


def compute_rolling_returns(
    series: pd.Series,
    window_years: float = 3.0,
    trading_days_per_year: int = 252
) -> pd.Series:
    """
    Vectorized calculation of rolling annualized returns.
    Formula: Rolling CAGR = (P_t / P_{t - W}) ** (252 / W) - 1
    """
    window_days = int(window_years * trading_days_per_year)
    cleaned = series.dropna().sort_index()
    if len(cleaned) <= window_days:
        return pd.Series(dtype=float)

    # Shifted series for exact vectorized CAGR
    shifted = cleaned.shift(window_days)
    rolling_cagr = (cleaned / shifted) ** (trading_days_per_year / window_days) - 1.0
    return rolling_cagr.dropna()


def compute_rolling_distribution_stats(rolling_series: pd.Series) -> Dict[str, float]:
    """
    Compute statistical distribution metrics for rolling returns:
    Mean, Median, Min, Max, 25th percentile, 75th percentile, Std.
    """
    if rolling_series.empty:
        return {
            "mean": 0.0, "median": 0.0, "min": 0.0, "max": 0.0,
            "q25": 0.0, "q75": 0.0, "std": 0.0, "count": 0
        }

    return {
        "mean": round(float(rolling_series.mean() * 100.0), 2),
        "median": round(float(rolling_series.median() * 100.0), 2),
        "min": round(float(rolling_series.min() * 100.0), 2),
        "max": round(float(rolling_series.max() * 100.0), 2),
        "q25": round(float(rolling_series.quantile(0.25) * 100.0), 2),
        "q75": round(float(rolling_series.quantile(0.75) * 100.0), 2),
        "std": round(float(rolling_series.std() * 100.0), 2),
        "count": len(rolling_series)
    }


def compute_benchmark_hit_rate(
    fund_rolling: pd.Series,
    benchmark_rolling: pd.Series
) -> float:
    """
    Calculate Benchmark Hit Rate:
    Percentage of rolling windows where the fund's annualized return exceeded benchmark.
    Formula: (Count(Fund_Rolling > Bench_Rolling) / Total_Common_Windows) * 100%
    """
    aligned = pd.concat([fund_rolling.rename("fund"), benchmark_rolling.rename("bench")], axis=1).dropna()
    if aligned.empty:
        return 0.0

    outperformed_count = (aligned["fund"] > aligned["bench"]).sum()
    hit_rate = (outperformed_count / len(aligned)) * 100.0
    return round(float(hit_rate), 2)


def compute_risk_ratios(
    returns_series: pd.Series,
    rf_annual: float = 0.065,
    trading_days_per_year: int = 252
) -> Dict[str, float]:
    """
    Vectorized computation of Volatility, Sharpe Ratio, and Sortino Ratio.
    - Volatility (Annualized): std(R) * sqrt(252)
    - Sharpe: (CAGR - Rf) / Annualized_Vol
    - Sortino: (CAGR - Rf) / Downside_Semi_Deviation (relative to Rf/252)
    """
    ret = returns_series.dropna()
    if len(ret) < 20:
        return {"volatility": 0.0, "sharpe": 0.0, "sortino": 0.0, "annualized_return": 0.0}

    # Annualized arithmetic / geometric return
    cum_ret = (1.0 + ret).prod()
    n_days = len(ret)
    ann_return = (cum_ret ** (trading_days_per_year / n_days)) - 1.0

    # Annualized Volatility
    ann_vol = float(ret.std() * np.sqrt(trading_days_per_year))

    # Sharpe Ratio
    excess_return = ann_return - rf_annual
    sharpe = float(excess_return / ann_vol) if ann_vol > 1e-6 else 0.0

    # Sortino Ratio: Downside deviation relative to daily Rf
    rf_daily = (1.0 + rf_annual) ** (1.0 / trading_days_per_year) - 1.0
    downside_diff = np.minimum(0.0, ret - rf_daily)
    downside_variance = np.mean(downside_diff ** 2)
    downside_dev = float(np.sqrt(downside_variance) * np.sqrt(trading_days_per_year))
    sortino = float(excess_return / downside_dev) if downside_dev > 1e-6 else 0.0

    return {
        "volatility": round(ann_vol * 100.0, 2),
        "annualized_return": round(ann_return * 100.0, 2),
        "sharpe": round(sharpe, 2),
        "sortino": round(sortino, 2),
    }


def compute_cml_metrics(
    fund_returns: pd.Series,
    benchmark_returns: pd.Series,
    rf_annual: float = 0.065,
    trading_days_per_year: int = 252
) -> Dict[str, float]:
    """
    Capital Market Line & Regression Metrics:
    - Beta (beta = Cov(R_f, R_m) / Var(R_m))
    - Jensen's Alpha = R_p - [Rf + beta * (R_m - Rf)]
    - R-Squared (R2 = correlation^2)
    """
    aligned = pd.concat([fund_returns.rename("fund"), benchmark_returns.rename("bench")], axis=1).dropna()
    if len(aligned) < 30:
        return {"beta": 1.0, "alpha": 0.0, "r2": 0.0}

    cov_matrix = np.cov(aligned["fund"], aligned["bench"])
    var_bench = cov_matrix[1, 1]
    cov_fb = cov_matrix[0, 1]

    beta = float(cov_fb / var_bench) if var_bench > 1e-8 else 1.0

    # Annualized returns for Alpha
    cum_fund = (1.0 + aligned["fund"]).prod()
    cum_bench = (1.0 + aligned["bench"]).prod()
    n_days = len(aligned)

    ann_ret_fund = (cum_fund ** (trading_days_per_year / n_days)) - 1.0
    ann_ret_bench = (cum_bench ** (trading_days_per_year / n_days)) - 1.0

    # Jensen's Alpha
    expected_return = rf_annual + beta * (ann_ret_bench - rf_annual)
    jensens_alpha = float(ann_ret_fund - expected_return)

    # R-squared
    corr = np.corrcoef(aligned["fund"], aligned["bench"])[0, 1]
    r_squared = float(corr ** 2) if not np.isnan(corr) else 0.0

    return {
        "beta": round(beta, 2),
        "alpha": round(jensens_alpha * 100.0, 2),  # in percentage
        "r2": round(r_squared, 3),
    }


def compute_active_metrics(
    fund_returns: pd.Series,
    benchmark_returns: pd.Series,
    trading_days_per_year: int = 252
) -> Dict[str, float]:
    """
    Compute Active Management Metrics:
    - Tracking Error: Annualized standard deviation of excess daily returns
    - Information Ratio: Annualized excess return / Tracking Error
    """
    aligned = pd.concat([fund_returns.rename("fund"), benchmark_returns.rename("bench")], axis=1).dropna()
    if len(aligned) < 20:
        return {"tracking_error": 0.0, "information_ratio": 0.0}

    diff = aligned["fund"] - aligned["bench"]
    tracking_error = float(diff.std() * np.sqrt(trading_days_per_year))

    # Annualized excess return
    n_days = len(aligned)
    ann_fund = ((1.0 + aligned["fund"]).prod() ** (trading_days_per_year / n_days)) - 1.0
    ann_bench = ((1.0 + aligned["bench"]).prod() ** (trading_days_per_year / n_days)) - 1.0
    excess_ann = ann_fund - ann_bench

    info_ratio = float(excess_ann / tracking_error) if tracking_error > 1e-6 else 0.0

    return {
        "tracking_error": round(tracking_error * 100.0, 2),
        "information_ratio": round(info_ratio, 2),
    }


def compute_drawdowns(price_series: pd.Series) -> Dict[str, Any]:
    """
    Compute Drawdown series, Maximum Drawdown, and Recovery Period.
    Formula: Drawdown_t = (P_t - CumMax_t) / CumMax_t
    """
    cleaned = price_series.dropna().sort_index()
    if cleaned.empty:
        return {
            "max_drawdown": 0.0,
            "max_dd_date": "",
            "peak_date": "",
            "recovery_date": "",
            "recovery_days": 0,
            "drawdown_series": pd.Series(dtype=float)
        }

    running_max = cleaned.cummax()
    drawdown_series = (cleaned - running_max) / running_max

    min_dd = float(drawdown_series.min())
    max_dd_idx = drawdown_series.idxmin()

    # Find the peak that preceded the max drawdown
    sub_peak = cleaned.loc[:max_dd_idx]
    peak_val = sub_peak.max()
    peak_idx = sub_peak[sub_peak == peak_val].index[-1]

    # Find recovery: first date after max drawdown where price >= peak_val
    sub_recovery = cleaned.loc[max_dd_idx:]
    recovered = sub_recovery[sub_recovery >= peak_val]

    if not recovered.empty:
        recovery_idx = recovered.index[0]
        recovery_days = (recovery_idx - peak_idx).days
        recovery_str = recovery_idx.strftime("%Y-%m-%d")
    else:
        recovery_str = "Ongoing / Not Recovered"
        recovery_days = (cleaned.index[-1] - peak_idx).days

    return {
        "max_drawdown": round(min_dd * 100.0, 2),
        "max_dd_date": max_dd_idx.strftime("%Y-%m-%d") if hasattr(max_dd_idx, "strftime") else str(max_dd_idx),
        "peak_date": peak_idx.strftime("%Y-%m-%d") if hasattr(peak_idx, "strftime") else str(peak_idx),
        "recovery_date": recovery_str,
        "recovery_days": recovery_days,
        "drawdown_series": drawdown_series
    }
