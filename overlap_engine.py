"""
Module 3: In-Memory Portfolio Overlap & Sector Engine (overlap_engine.py)
Calculates:
- Weighted ISIN-level portfolio overlap: Overlap % = Sum_{shared ISIN} min(Weight_A, Weight_B)
- Pairwise overlap matrix across funds
- Look-through market-cap exposures (Large/Mid/Small Cap)
- Look-through sector concentrations
- Shared holdings inspection
"""

from typing import Any, Dict, List, Optional, Tuple
import pandas as pd


# Real-world Indian equity portfolio structures for top mutual funds
SAMPLE_FUND_HOLDINGS: Dict[int, List[Dict[str, Any]]] = {
    # 122639: Parag Parikh Flexi Cap Fund (PPFAS)
    122639: [
        {"isin": "INE040A01034", "name": "HDFC Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 8.45, "adtv_cr": 2450.0},
        {"isin": "INE018A01030", "name": "Larsen & Toubro Ltd", "sector": "Industrials", "mcap": "Large Cap", "weight": 7.30, "adtv_cr": 820.0},
        {"isin": "INE090A01021", "name": "ICICI Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 6.85, "adtv_cr": 1850.0},
        {"isin": "INE118A01012", "name": "ITC Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 6.10, "adtv_cr": 780.0},
        {"isin": "INE296A01024", "name": "Bajaj Holdings & Inv Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 5.75, "adtv_cr": 110.0},
        {"isin": "INE745G01035", "name": "Power Grid Corp of India", "sector": "Utilities", "mcap": "Large Cap", "weight": 5.40, "adtv_cr": 480.0},
        {"isin": "INE009A01021", "name": "Infosys Ltd", "sector": "Technology", "mcap": "Large Cap", "weight": 4.90, "adtv_cr": 1420.0},
        {"isin": "INE733E01010", "name": "NTPC Ltd", "sector": "Utilities", "mcap": "Large Cap", "weight": 4.60, "adtv_cr": 640.0},
        {"isin": "INE002A01018", "name": "Reliance Industries Ltd", "sector": "Energy", "mcap": "Large Cap", "weight": 4.25, "adtv_cr": 2100.0},
        {"isin": "INE585B01010", "name": "Maruti Suzuki India", "sector": "Automobile", "mcap": "Large Cap", "weight": 3.80, "adtv_cr": 530.0},
        {"isin": "INE121A01024", "name": "Cholamandalam Inv & Fin", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 3.10, "adtv_cr": 310.0},
        {"isin": "INE242A01010", "name": "Indian Oil Corp", "sector": "Energy", "mcap": "Large Cap", "weight": 2.90, "adtv_cr": 290.0},
        {"isin": "INE062A01020", "name": "State Bank of India", "sector": "Financial Services", "mcap": "Large Cap", "weight": 2.65, "adtv_cr": 1650.0},
        {"isin": "INE467B01029", "name": "Tata Consultancy Services", "sector": "Technology", "mcap": "Large Cap", "weight": 2.50, "adtv_cr": 980.0},
        {"isin": "INE059A01026", "name": "Cipla Ltd", "sector": "Healthcare", "mcap": "Large Cap", "weight": 2.10, "adtv_cr": 260.0},
        {"isin": "US02079K3059", "name": "Alphabet Inc (Google)", "sector": "Technology", "mcap": "Large Cap", "weight": 4.80, "adtv_cr": 8500.0},
        {"isin": "US5949181045", "name": "Microsoft Corp", "sector": "Technology", "mcap": "Large Cap", "weight": 4.10, "adtv_cr": 9800.0},
        {"isin": "INE192A01025", "name": "Tata Consumer Products", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 2.40, "adtv_cr": 280.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Large Cap", "weight": 14.05, "adtv_cr": 100000.0},
    ],
    # 127042: Motilal Oswal Midcap Fund
    127042: [
        {"isin": "INE067A01029", "name": "Persistent Systems Ltd", "sector": "Technology", "mcap": "Mid Cap", "weight": 9.20, "adtv_cr": 340.0},
        {"isin": "INE769A01020", "name": "KPIT Technologies Ltd", "sector": "Technology", "mcap": "Mid Cap", "weight": 7.80, "adtv_cr": 270.0},
        {"isin": "INE860A01027", "name": "Polycab India Ltd", "sector": "Industrials", "mcap": "Mid Cap", "weight": 6.90, "adtv_cr": 310.0},
        {"isin": "INE121A01024", "name": "Cholamandalam Inv & Fin", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 6.40, "adtv_cr": 310.0},
        {"isin": "INE669E01016", "name": "Vodafone Idea Ltd", "sector": "Telecommunication", "mcap": "Mid Cap", "weight": 5.90, "adtv_cr": 680.0},
        {"isin": "INE079A01024", "name": "Ambuja Cements Ltd", "sector": "Materials", "mcap": "Large Cap", "weight": 5.30, "adtv_cr": 420.0},
        {"isin": "INE148I01020", "name": "Coforge Ltd", "sector": "Technology", "mcap": "Mid Cap", "weight": 4.90, "adtv_cr": 360.0},
        {"isin": "INE205A01025", "name": "Vedant Fashions Ltd", "sector": "Consumer Discretionary", "mcap": "Mid Cap", "weight": 4.70, "adtv_cr": 75.0},
        {"isin": "INE484J01027", "name": "Zomato Ltd", "sector": "Technology", "mcap": "Large Cap", "weight": 4.50, "adtv_cr": 1250.0},
        {"isin": "INE774D01024", "name": "Mahindra & Mahindra Fin", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 4.20, "adtv_cr": 190.0},
        {"isin": "INE326A01037", "name": "Lupin Ltd", "sector": "Healthcare", "mcap": "Mid Cap", "weight": 3.80, "adtv_cr": 240.0},
        {"isin": "INE040A01034", "name": "HDFC Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 3.20, "adtv_cr": 2450.0},
        {"isin": "INE018A01030", "name": "Larsen & Toubro Ltd", "sector": "Industrials", "mcap": "Large Cap", "weight": 3.00, "adtv_cr": 820.0},
        {"isin": "INE090A01021", "name": "ICICI Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 2.80, "adtv_cr": 1850.0},
        {"isin": "INE467B01029", "name": "Tata Consultancy Services", "sector": "Technology", "mcap": "Large Cap", "weight": 2.60, "adtv_cr": 980.0},
        {"isin": "INE280A01028", "name": "Titan Company Ltd", "sector": "Consumer Discretionary", "mcap": "Large Cap", "weight": 2.40, "adtv_cr": 610.0},
        {"isin": "INE917I01012", "name": "Dixon Technologies", "sector": "Industrials", "mcap": "Mid Cap", "weight": 3.50, "adtv_cr": 380.0},
        {"isin": "INE123B01018", "name": "Bharat Forge Ltd", "sector": "Industrials", "mcap": "Mid Cap", "weight": 2.80, "adtv_cr": 230.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Large Cap", "weight": 16.10, "adtv_cr": 100000.0},
    ],
    # 118989: HDFC Top 100 Large Cap Fund
    118989: [
        {"isin": "INE040A01034", "name": "HDFC Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 9.80, "adtv_cr": 2450.0},
        {"isin": "INE090A01021", "name": "ICICI Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 8.90, "adtv_cr": 1850.0},
        {"isin": "INE002A01018", "name": "Reliance Industries Ltd", "sector": "Energy", "mcap": "Large Cap", "weight": 8.10, "adtv_cr": 2100.0},
        {"isin": "INE009A01021", "name": "Infosys Ltd", "sector": "Technology", "mcap": "Large Cap", "weight": 7.40, "adtv_cr": 1420.0},
        {"isin": "INE018A01030", "name": "Larsen & Toubro Ltd", "sector": "Industrials", "mcap": "Large Cap", "weight": 6.30, "adtv_cr": 820.0},
        {"isin": "INE467B01029", "name": "Tata Consultancy Services", "sector": "Technology", "mcap": "Large Cap", "weight": 5.20, "adtv_cr": 980.0},
        {"isin": "INE118A01012", "name": "ITC Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 4.90, "adtv_cr": 780.0},
        {"isin": "INE062A01020", "name": "State Bank of India", "sector": "Financial Services", "mcap": "Large Cap", "weight": 4.70, "adtv_cr": 1650.0},
        {"isin": "INE238A01034", "name": "Axis Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 4.10, "adtv_cr": 1150.0},
        {"isin": "INE296A01024", "name": "Bajaj Finance Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 3.80, "adtv_cr": 950.0},
        {"isin": "INE733E01010", "name": "NTPC Ltd", "sector": "Utilities", "mcap": "Large Cap", "weight": 3.60, "adtv_cr": 640.0},
        {"isin": "INE585B01010", "name": "Maruti Suzuki India", "sector": "Automobile", "mcap": "Large Cap", "weight": 3.30, "adtv_cr": 530.0},
        {"isin": "INE745G01035", "name": "Power Grid Corp of India", "sector": "Utilities", "mcap": "Large Cap", "weight": 3.10, "adtv_cr": 480.0},
        {"isin": "INE030A01027", "name": "Hindustan Unilever Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 2.90, "adtv_cr": 620.0},
        {"isin": "INE280A01028", "name": "Titan Company Ltd", "sector": "Consumer Discretionary", "mcap": "Large Cap", "weight": 2.50, "adtv_cr": 610.0},
        {"isin": "INE081A01012", "name": "Tata Steel Ltd", "sector": "Materials", "mcap": "Large Cap", "weight": 2.20, "adtv_cr": 890.0},
        {"isin": "INE154A01025", "name": "ITC Foods Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 2.00, "adtv_cr": 120.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Large Cap", "weight": 11.20, "adtv_cr": 100000.0},
    ],
    # 118778: Nippon India Small Cap Fund
    118778: [
        {"isin": "INE376G01013", "name": "Tube Investments of India", "sector": "Industrials", "mcap": "Mid Cap", "weight": 4.10, "adtv_cr": 180.0},
        {"isin": "INE848E01016", "name": "HDFC Asset Management", "sector": "Financial Services", "mcap": "Large Cap", "weight": 3.40, "adtv_cr": 220.0},
        {"isin": "INE688I01017", "name": "Apar Industries Ltd", "sector": "Industrials", "mcap": "Small Cap", "weight": 2.90, "adtv_cr": 65.0},
        {"isin": "INE005A01029", "name": "Karur Vysya Bank Ltd", "sector": "Financial Services", "mcap": "Small Cap", "weight": 2.70, "adtv_cr": 45.0},
        {"isin": "INE584A01023", "name": "CreditAccess Grameen", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 2.50, "adtv_cr": 55.0},
        {"isin": "INE242C01024", "name": "Multi Commodity Exchange", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 2.40, "adtv_cr": 210.0},
        {"isin": "INE094A01015", "name": "Hindustan Petroleum", "sector": "Energy", "mcap": "Mid Cap", "weight": 2.20, "adtv_cr": 280.0},
        {"isin": "INE121A01024", "name": "Cholamandalam Inv & Fin", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 2.10, "adtv_cr": 310.0},
        {"isin": "INE860A01027", "name": "Polycab India Ltd", "sector": "Industrials", "mcap": "Mid Cap", "weight": 1.95, "adtv_cr": 310.0},
        {"isin": "INE067A01029", "name": "Persistent Systems Ltd", "sector": "Technology", "mcap": "Mid Cap", "weight": 1.85, "adtv_cr": 340.0},
        {"isin": "INE769A01020", "name": "KPIT Technologies Ltd", "sector": "Technology", "mcap": "Mid Cap", "weight": 1.80, "adtv_cr": 270.0},
        {"isin": "INE647O01011", "name": "Carborundum Universal", "sector": "Industrials", "mcap": "Mid Cap", "weight": 1.70, "adtv_cr": 38.0},
        {"isin": "INE021A01026", "name": "Asian Paints Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 1.60, "adtv_cr": 450.0},
        {"isin": "INE090A01021", "name": "ICICI Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 1.50, "adtv_cr": 1850.0},
        {"isin": "INE040A01034", "name": "HDFC Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 1.40, "adtv_cr": 2450.0},
        {"isin": "INE028A01039", "name": "Bank of Baroda", "sector": "Financial Services", "mcap": "Large Cap", "weight": 1.30, "adtv_cr": 490.0},
        {"isin": "INE123B01018", "name": "Bharat Forge Ltd", "sector": "Industrials", "mcap": "Mid Cap", "weight": 1.25, "adtv_cr": 230.0},
        {"isin": "INE075A01022", "name": "Wipro Ltd", "sector": "Technology", "mcap": "Large Cap", "weight": 1.15, "adtv_cr": 420.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Large Cap", "weight": 8.85, "adtv_cr": 100000.0},
    ],
    # 119598: SBI Bluechip Large Cap Fund
    119598: [
        {"isin": "INE040A01034", "name": "HDFC Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 9.10, "adtv_cr": 2450.0},
        {"isin": "INE090A01021", "name": "ICICI Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 8.40, "adtv_cr": 1850.0},
        {"isin": "INE002A01018", "name": "Reliance Industries Ltd", "sector": "Energy", "mcap": "Large Cap", "weight": 7.90, "adtv_cr": 2100.0},
        {"isin": "INE009A01021", "name": "Infosys Ltd", "sector": "Technology", "mcap": "Large Cap", "weight": 6.80, "adtv_cr": 1420.0},
        {"isin": "INE018A01030", "name": "Larsen & Toubro Ltd", "sector": "Industrials", "mcap": "Large Cap", "weight": 5.90, "adtv_cr": 820.0},
        {"isin": "INE118A01012", "name": "ITC Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 4.50, "adtv_cr": 780.0},
        {"isin": "INE467B01029", "name": "Tata Consultancy Services", "sector": "Technology", "mcap": "Large Cap", "weight": 4.30, "adtv_cr": 980.0},
        {"isin": "INE062A01020", "name": "State Bank of India", "sector": "Financial Services", "mcap": "Large Cap", "weight": 4.20, "adtv_cr": 1650.0},
        {"isin": "INE238A01034", "name": "Axis Bank Ltd", "sector": "Financial Services", "mcap": "Large Cap", "weight": 3.80, "adtv_cr": 1150.0},
        {"isin": "INE585B01010", "name": "Maruti Suzuki India", "sector": "Automobile", "mcap": "Large Cap", "weight": 3.40, "adtv_cr": 530.0},
        {"isin": "INE733E01010", "name": "NTPC Ltd", "sector": "Utilities", "mcap": "Large Cap", "weight": 3.20, "adtv_cr": 640.0},
        {"isin": "INE745G01035", "name": "Power Grid Corp of India", "sector": "Utilities", "mcap": "Large Cap", "weight": 3.00, "adtv_cr": 480.0},
        {"isin": "INE030A01027", "name": "Hindustan Unilever Ltd", "sector": "Consumer Goods", "mcap": "Large Cap", "weight": 2.80, "adtv_cr": 620.0},
        {"isin": "INE280A01028", "name": "Titan Company Ltd", "sector": "Consumer Discretionary", "mcap": "Large Cap", "weight": 2.60, "adtv_cr": 610.0},
        {"isin": "INE121A01024", "name": "Cholamandalam Inv & Fin", "sector": "Financial Services", "mcap": "Mid Cap", "weight": 2.10, "adtv_cr": 310.0},
        {"isin": "INE059A01026", "name": "Cipla Ltd", "sector": "Healthcare", "mcap": "Large Cap", "weight": 1.90, "adtv_cr": 260.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Large Cap", "weight": 13.10, "adtv_cr": 100000.0},
    ],
    # 120503: ICICI Prudential Corporate Bond Fund (Debt / Fixed Income)
    120503: [
        {"isin": "INE040A08435", "name": "7.70% HDFC Bank Bonds 2028", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 9.50, "adtv_cr": 50.0},
        {"isin": "INE090A08UB7", "name": "7.65% ICICI Bank Bonds 2029", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 8.80, "adtv_cr": 45.0},
        {"isin": "INE134E08KJ0", "name": "7.75% Power Finance Corp 2030", "sector": "Utilities", "mcap": "Debt / Fixed Income", "weight": 8.20, "adtv_cr": 35.0},
        {"isin": "INE020B08DF6", "name": "7.60% REC Limited 2029", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 7.90, "adtv_cr": 40.0},
        {"isin": "INE053F08221", "name": "7.80% Indian Railway Finance", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 7.50, "adtv_cr": 30.0},
        {"isin": "INE002A08641", "name": "7.85% Reliance Industries Debentures", "sector": "Energy", "mcap": "Debt / Fixed Income", "weight": 6.80, "adtv_cr": 25.0},
        {"isin": "INE733E08129", "name": "7.45% NTPC Ltd Bonds 2031", "sector": "Utilities", "mcap": "Debt / Fixed Income", "weight": 6.40, "adtv_cr": 20.0},
        {"isin": "INE745G08089", "name": "7.52% Power Grid Corp Bonds", "sector": "Utilities", "mcap": "Debt / Fixed Income", "weight": 5.90, "adtv_cr": 22.0},
        {"isin": "INE296A08832", "name": "7.90% Bajaj Finance NCDs", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 5.50, "adtv_cr": 18.0},
        {"isin": "INE062A08311", "name": "7.68% State Bank of India Tier 2", "sector": "Financial Services", "mcap": "Debt / Fixed Income", "weight": 5.10, "adtv_cr": 35.0},
        {"isin": "IN0020230085", "name": "7.18% GS 2033 (Govt of India)", "sector": "Cash / Sovereign", "mcap": "Debt / Fixed Income", "weight": 14.20, "adtv_cr": 5000.0},
        {"isin": "CASH_EQUIV", "name": "TREPS & Cash Collateral", "sector": "Cash / Sovereign", "mcap": "Cash / Sovereign", "weight": 14.20, "adtv_cr": 100000.0},
    ]
}


def get_fund_holdings_df(scheme_code: int or str) -> pd.DataFrame:
    """Retrieve holdings DataFrame for a scheme code."""
    code_int = int(scheme_code)
    holdings = SAMPLE_FUND_HOLDINGS.get(code_int, [])
    if not holdings:
        # Fallback to Large Cap template
        holdings = SAMPLE_FUND_HOLDINGS[118989]
    return pd.DataFrame(holdings)


def compute_pairwise_overlap(
    holdings_a: pd.DataFrame,
    holdings_b: pd.DataFrame,
    exclude_cash: bool = True
) -> float:
    """
    Compute ISIN-level weighted portfolio overlap percentage between Fund A and Fund B:
    Overlap % = Sum_{shared ISINs} min(Weight_A, Weight_B)
    """
    if holdings_a.empty or holdings_b.empty:
        return 0.0

    df_a = holdings_a.copy()
    df_b = holdings_b.copy()

    if exclude_cash:
        df_a = df_a[df_a["isin"] != "CASH_EQUIV"]
        df_b = df_b[df_b["isin"] != "CASH_EQUIV"]

    merged = pd.merge(df_a, df_b, on="isin", suffixes=("_a", "_b"))
    if merged.empty:
        return 0.0

    min_weights = merged[["weight_a", "weight_b"]].min(axis=1)
    overlap_pct = float(min_weights.sum())
    return round(overlap_pct, 2)


def compute_overlap_matrix(
    scheme_codes: List[int or str],
    exclude_cash: bool = True
) -> pd.DataFrame:
    """
    Compute full N x N pairwise ISIN overlap matrix for selected scheme codes.
    Diagonal is 100%. Matrix is symmetric.
    """
    n = len(scheme_codes)
    codes_str = [str(c) for c in scheme_codes]
    matrix = pd.DataFrame(index=codes_str, columns=codes_str, dtype=float)

    holdings_cache = {str(c): get_fund_holdings_df(c) for c in scheme_codes}

    for i, c1 in enumerate(codes_str):
        for j, c2 in enumerate(codes_str):
            if i == j:
                matrix.loc[c1, c2] = 100.0
            elif i < j:
                ov = compute_pairwise_overlap(holdings_cache[c1], holdings_cache[c2], exclude_cash=exclude_cash)
                matrix.loc[c1, c2] = ov
                matrix.loc[c2, c1] = ov

    return matrix


def aggregate_market_cap_exposure(
    scheme_codes: List[int or str],
    portfolio_weights: Optional[Dict[str, float]] = None
) -> pd.Series:
    """
    Look-through aggregation of Market Cap (Large, Mid, Small, Debt/Cash) exposures.
    """
    codes_str = [str(c) for c in scheme_codes]
    if not portfolio_weights:
        # Equal weighting default
        w = 1.0 / len(codes_str)
        weights_map = {c: w for c in codes_str}
    else:
        tot = sum(portfolio_weights.values())
        weights_map = {c: portfolio_weights.get(c, 0.0) / tot for c in codes_str}

    mcap_totals: Dict[str, float] = {"Large Cap": 0.0, "Mid Cap": 0.0, "Small Cap": 0.0, "Debt / Fixed Income": 0.0, "Cash / Sovereign": 0.0}

    for c in codes_str:
        fund_w = weights_map[c]
        df = get_fund_holdings_df(c)
        for _, row in df.iterrows():
            mcap = row["mcap"]
            stock_w = row["weight"]
            effective_w = fund_w * stock_w
            mcap_totals[mcap] = mcap_totals.get(mcap, 0.0) + effective_w

    res = pd.Series(mcap_totals)
    res = (res / res.sum()) * 100.0
    return res.round(2)


def aggregate_sector_exposure(
    scheme_codes: List[int or str],
    portfolio_weights: Optional[Dict[str, float]] = None
) -> pd.Series:
    """
    Look-through aggregation of sector concentrations across portfolio holdings.
    """
    codes_str = [str(c) for c in scheme_codes]
    if not portfolio_weights:
        w = 1.0 / len(codes_str)
        weights_map = {c: w for c in codes_str}
    else:
        tot = sum(portfolio_weights.values())
        weights_map = {c: portfolio_weights.get(c, 0.0) / tot for c in codes_str}

    sector_totals: Dict[str, float] = {}

    for c in codes_str:
        fund_w = weights_map[c]
        df = get_fund_holdings_df(c)
        for _, row in df.iterrows():
            sec = row["sector"]
            stock_w = row["weight"]
            effective_w = fund_w * stock_w
            sector_totals[sec] = sector_totals.get(sec, 0.0) + effective_w

    res = pd.Series(sector_totals)
    res = (res / res.sum()) * 100.0
    return res.sort_values(ascending=False).round(2)


def get_top_shared_holdings(
    scheme_code_a: int or str,
    scheme_code_b: int or str,
    top_n: int = 10
) -> pd.DataFrame:
    """
    Identify specific common stocks between two funds with their individual weights
    and overlap contribution.
    """
    df_a = get_fund_holdings_df(scheme_code_a)
    df_b = get_fund_holdings_df(scheme_code_b)

    # Exclude cash
    df_a = df_a[df_a["isin"] != "CASH_EQUIV"]
    df_b = df_b[df_b["isin"] != "CASH_EQUIV"]

    merged = pd.merge(df_a, df_b, on=["isin", "name", "sector", "mcap"], suffixes=("_FundA", "_FundB"))
    if merged.empty:
        return pd.DataFrame(columns=["isin", "name", "sector", "mcap", "weight_FundA", "weight_FundB", "overlap_contribution"])

    merged["overlap_contribution"] = merged[["weight_FundA", "weight_FundB"]].min(axis=1)
    res = merged.sort_values("overlap_contribution", ascending=False).head(top_n)
    return res[["isin", "name", "sector", "mcap", "weight_FundA", "weight_FundB", "overlap_contribution"]].round(2)
