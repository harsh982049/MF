"""
Module 4: Debt & Liquidity Stress Testing Engine (stress_test.py)
Implements:
1. Liquidity Stress Testing:
   - Days to liquidate 25% and 50% of portfolio based on 30-day ADTV
   - Pro-rata liquidation model vs Waterfall liquidation model
   - 10% institutional daily volume participation limit
2. Debt & Duration Sensitivity:
   - Macaulay Duration & Modified Duration
   - Convexity adjustment
   - Simulated NAV impact under yield curve shifts (±50bps, ±100bps, ±200bps)
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def calculate_liquidity_stress(
    holdings_df: pd.DataFrame,
    aum_crores: float = 25000.0,
    participation_rate: float = 0.10
) -> Dict[str, Any]:
    """
    Perform portfolio liquidity stress testing based on 30-day Average Daily Trading Volume (ADTV).

    Args:
        holdings_df: DataFrame with ['name', 'weight', 'adtv_cr', 'isin']
        aum_crores: Total Fund AUM in INR Crores
        participation_rate: Max fraction of daily market volume that fund can execute without market impact (default 10%)

    Returns:
        Dictionary containing days to liquidate 25% and 50%, illiquid buckets, and position details.
    """
    if holdings_df.empty:
        return {
            "days_25_prorata": 0.0,
            "days_50_prorata": 0.0,
            "days_25_waterfall": 0.0,
            "days_50_waterfall": 0.0,
            "pct_liquid_under_3_days": 100.0,
            "pct_illiquid_over_10_days": 0.0,
            "holdings_analysis": pd.DataFrame()
        }

    df = holdings_df.copy()
    
    # Position value in Crores: (weight / 100) * AUM
    df["position_cr"] = (df["weight"] / 100.0) * aum_crores
    
    # 10% daily volume limit: ADTV * participation_rate
    df["daily_absorbable_cr"] = df["adtv_cr"] * participation_rate
    
    # Days to liquidate 100% of this specific position
    # Handle cash or zero-ADTV edge cases
    df["days_to_liquidate_100pct"] = np.where(
        df["isin"] == "CASH_EQUIV",
        0.0,
        df["position_cr"] / np.maximum(df["daily_absorbable_cr"], 0.1)
    )

    # 1. Pro-Rata Liquidation:
    # Under pro-rata, to liquidate P% of the fund, we sell P% of every holding simultaneously.
    # The time required is dictated by the slowest asset in that proportional slice.
    days_25_prorata = float(df[df["isin"] != "CASH_EQUIV"]["days_to_liquidate_100pct"].max() * 0.25)
    days_50_prorata = float(df[df["isin"] != "CASH_EQUIV"]["days_to_liquidate_100pct"].max() * 0.50)

    # 2. Waterfall Liquidation (SEBI Mandated Stress Horizon):
    # Sort holdings by days_to_liquidate_100pct ascending (fastest first), accumulate weights to 25% and 50%
    sorted_df = df.sort_values("days_to_liquidate_100pct", ascending=True).copy()
    sorted_df["cum_weight"] = sorted_df["weight"].cumsum()

    # Time to reach 25% weight
    subset_25 = sorted_df[sorted_df["cum_weight"] <= 25.0]
    days_25_waterfall = float(subset_25["days_to_liquidate_100pct"].max()) if not subset_25.empty else 0.5

    # Time to reach 50% weight
    subset_50 = sorted_df[sorted_df["cum_weight"] <= 50.0]
    days_50_waterfall = float(subset_50["days_to_liquidate_100pct"].max()) if not subset_50.empty else 1.5

    # Liquidity distribution brackets (% of portfolio)
    pct_under_3 = float(df[df["days_to_liquidate_100pct"] <= 3.0]["weight"].sum())
    pct_3_to_7 = float(df[(df["days_to_liquidate_100pct"] > 3.0) & (df["days_to_liquidate_100pct"] <= 7.0)]["weight"].sum())
    pct_over_10 = float(df[df["days_to_liquidate_100pct"] > 10.0]["weight"].sum())

    return {
        "days_25_prorata": round(days_25_prorata, 1),
        "days_50_prorata": round(days_50_prorata, 1),
        "days_25_waterfall": round(days_25_waterfall, 1),
        "days_50_waterfall": round(days_50_waterfall, 1),
        "pct_liquid_under_3_days": round(pct_under_3, 1),
        "pct_3_to_7_days": round(pct_3_to_7, 1),
        "pct_illiquid_over_10_days": round(pct_over_10, 1),
        "holdings_analysis": df[[
            "isin", "name", "weight", "position_cr", "adtv_cr", "days_to_liquidate_100pct"
        ]].sort_values("days_to_liquidate_100pct", ascending=False).round(2)
    }


def calculate_duration_sensitivity(
    macaulay_duration: float = 4.2,
    current_ytm: float = 0.0725,
    convexity: float = 24.5,
    shock_bps_list: List[int] = [-200, -100, -50, 0, 50, 100, 200],
    base_nav: float = 100.0
) -> pd.DataFrame:
    """
    Simulate NAV impact under interest rate (yield curve) shifts using Macaulay Duration & Convexity.

    Formulas:
    - Modified Duration: D_mod = D_mac / (1 + YTM)
    - NAV Percentage Change: Delta_NAV% = -D_mod * Delta_y + 0.5 * Convexity * (Delta_y)^2
    - Simulated NAV: Base_NAV * (1 + Delta_NAV%)
    """
    mod_duration = macaulay_duration / (1.0 + current_ytm) if current_ytm > -1.0 else macaulay_duration

    records = []
    for bps in shock_bps_list:
        delta_y = bps / 10000.0  # 100 bps = 0.0100
        
        # Duration effect (first-order linear)
        duration_impact_pct = -mod_duration * delta_y
        
        # Convexity effect (second-order curvature benefit)
        convexity_impact_pct = 0.5 * convexity * (delta_y ** 2)
        
        total_impact_pct = duration_impact_pct + convexity_impact_pct
        simulated_nav = base_nav * (1.0 + total_impact_pct)
        
        records.append({
            "shock_bps": bps,
            "shock_pct": round(delta_y * 100.0, 2),
            "duration_impact_pct": round(duration_impact_pct * 100.0, 2),
            "convexity_impact_pct": round(convexity_impact_pct * 100.0, 3),
            "total_nav_change_pct": round(total_impact_pct * 100.0, 2),
            "simulated_nav": round(simulated_nav, 2),
        })

    return pd.DataFrame(records)


def simulate_custom_rate_shock(
    macaulay_duration: float,
    current_ytm: float,
    custom_bps: float,
    convexity: float = 24.5,
    base_nav: float = 100.0
) -> Dict[str, float]:
    """Calculate single custom rate shock for interactive slider in frontend."""
    mod_duration = macaulay_duration / (1.0 + current_ytm) if current_ytm > -1.0 else macaulay_duration
    delta_y = custom_bps / 10000.0
    
    dur_effect = -mod_duration * delta_y
    cvx_effect = 0.5 * convexity * (delta_y ** 2)
    tot_effect = dur_effect + cvx_effect
    
    return {
        "modified_duration": round(mod_duration, 2),
        "rate_shock_bps": custom_bps,
        "delta_yield_pct": round(delta_y * 100.0, 2),
        "duration_impact_pct": round(dur_effect * 100.0, 2),
        "convexity_benefit_pct": round(cvx_effect * 100.0, 3),
        "total_nav_change_pct": round(tot_effect * 100.0, 2),
        "simulated_nav": round(base_nav * (1.0 + tot_effect), 2),
    }
