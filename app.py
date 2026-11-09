"""
Module 5: Streamlit Frontend & Visualizations (app.py)
Interactive Quantitative Dashboard for Indian Mutual Funds.
Run with: streamlit run app.py
"""

from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Check if streamlit and plotly are available
try:
    import streamlit as st
    import plotly.graph_objects as go
    import plotly.express as px
    STREAMLIT_AVAILABLE = True
except ImportError:
    STREAMLIT_AVAILABLE = False

from data_loader import (
    PRESET_FUNDS,
    BENCHMARK_SYMBOLS,
    fetch_fund_nav_mfapi,
    fetch_benchmark_series,
    get_aligned_fund_and_benchmark,
)
from quant_engine import (
    compute_trailing_cagr,
    compute_rolling_returns,
    compute_rolling_distribution_stats,
    compute_benchmark_hit_rate,
    compute_risk_ratios,
    compute_cml_metrics,
    compute_active_metrics,
    compute_drawdowns,
)
from overlap_engine import (
    SAMPLE_FUND_HOLDINGS,
    get_fund_holdings_df,
    compute_overlap_matrix,
    aggregate_market_cap_exposure,
    aggregate_sector_exposure,
    get_top_shared_holdings,
)
from stress_test import (
    calculate_liquidity_stress,
    calculate_duration_sensitivity,
    simulate_custom_rate_shock,
)


def main():
    if not STREAMLIT_AVAILABLE:
        print("Please install requirements: pip install streamlit plotly pandas numpy requests yfinance")
        return

    st.set_page_config(
        page_title="Indian Mutual Funds Quant & Risk Analytics",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    # Custom CSS for dark institutional styling
    st.markdown("""
        <style>
        .metric-card {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .metric-title {
            color: #94a3b8;
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .metric-value {
            color: #f8fafc;
            font-size: 24px;
            font-weight: 700;
            font-family: monospace;
        }
        .metric-sub {
            color: #38bdf8;
            font-size: 12px;
            margin-top: 4px;
        }
        </style>
    """, unsafe_allow_html=True)

    # Sidebar Controls
    st.sidebar.title("Portfolio Settings")
    st.sidebar.markdown("---")

    # Fund Selection
    fund_options = {f"{meta['name']} ({code})": code for code, meta in PRESET_FUNDS.items()}
    default_selected = [
        "Parag Parikh Flexi Cap Fund (122639)",
        "Motilal Oswal Midcap Fund (127042)",
        "HDFC Top 100 Large Cap Fund (118989)",
        "Nippon India Small Cap Fund (118778)"
    ]
    
    selected_labels = st.sidebar.multiselect(
        "Select Mutual Funds (Direct Schemes)",
        options=list(fund_options.keys()),
        default=[l for l in default_selected if l in fund_options]
    )
    
    # Custom Scheme Code input
    custom_code = st.sidebar.text_input("Add Custom Scheme Code (mfapi.in)", placeholder="e.g., 120503")
    selected_codes = [fund_options[l] for l in selected_labels]
    if custom_code.strip() and custom_code.strip().isdigit():
        c_code = custom_code.strip()
        if c_code not in selected_codes:
            selected_codes.append(c_code)

    if not selected_codes:
        st.warning("Please select at least one mutual fund scheme from the sidebar.")
        return

    # Benchmark selection
    bench_symbol = st.sidebar.selectbox(
        "Benchmark Index",
        options=list(BENCHMARK_SYMBOLS.keys()),
        format_func=lambda s: f"{BENCHMARK_SYMBOLS[s]} ({s})",
        index=1  # Default to Nifty 500
    )

    # Time Horizon
    horizon_years = st.sidebar.selectbox("Historical Horizon", [1, 3, 5, 7, 10], index=2)
    rf_rate = st.sidebar.slider("Risk-Free Rate (Rf %)", min_value=4.0, max_value=9.0, value=6.5, step=0.25) / 100.0
    adtv_participation = st.sidebar.slider("ADTV Participation Rate (%)", min_value=5, max_value=30, value=10, step=5) / 100.0

    st.title("Indian Mutual Funds Quantitative Risk & Overlap Engine")
    st.markdown(f"**Benchmark:** {BENCHMARK_SYMBOLS[bench_symbol]} · **Risk-Free Rate:** {rf_rate*100:.2f}% · **Liquidity Participation:** {adtv_participation*100:.0f}% ADTV")

    # Load Data
    with st.spinner("Ingesting NAV series and calculating aligned time-series..."):
        aligned_df = get_aligned_fund_and_benchmark(selected_codes, bench_symbol, years=horizon_years)

    if aligned_df.empty:
        st.error("Failed to load historical price series. Please verify network connection or scheme codes.")
        return

    # Tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "Performance & Rolling",
        "Risk & Capital Market Metrics",
        "Portfolio Overlap & Holdings",
        "Liquidity & Duration Stress",
        "Python Code Suite"
    ])

    # ==========================================
    # TAB 1: Performance & Rolling
    # ==========================================
    with tab1:
        st.subheader("Cumulative Growth (Rebased to 100)")
        
        # Normalize prices to base 100
        rebased_df = (aligned_df / aligned_df.iloc[0]) * 100.0
        
        fig_cum = go.Figure()
        for code in selected_codes:
            c_int = int(code)
            if c_int in rebased_df.columns:
                name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                fig_cum.add_trace(go.Scatter(
                    x=rebased_df.index, y=rebased_df[c_int],
                    mode="lines", name=name, line=dict(width=2)
                ))
                
        # Benchmark trace
        if "benchmark_close" in rebased_df.columns:
            fig_cum.add_trace(go.Scatter(
                x=rebased_df.index, y=rebased_df["benchmark_close"],
                mode="lines", name=f"Benchmark ({BENCHMARK_SYMBOLS[bench_symbol]})",
                line=dict(color="#f59e0b", width=2.5, dash="dash")
            ))
            
        fig_cum.update_layout(
            template="plotly_dark",
            height=420,
            margin=dict(l=20, r=20, t=20, b=20),
            hovermode="x unified",
            yaxis_title="Growth (Base = 100)"
        )
        st.plotly_chart(fig_cum, use_container_width=True)

        col_cagr, col_hit = st.columns([1, 1])

        with col_cagr:
            st.subheader("Trailing CAGR (%) Matrix")
            cagr_rows = []
            for code in selected_codes:
                c_int = int(code)
                if c_int in aligned_df.columns:
                    name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                    cagr_dict = compute_trailing_cagr(aligned_df[c_int], [1, 3, 5, 7])
                    cagr_dict["Fund"] = name
                    cagr_rows.append(cagr_dict)
            
            if "benchmark_close" in aligned_df.columns:
                bench_cagr = compute_trailing_cagr(aligned_df["benchmark_close"], [1, 3, 5, 7])
                bench_cagr["Fund"] = f"Benchmark ({BENCHMARK_SYMBOLS[bench_symbol]})"
                cagr_rows.append(bench_cagr)

            cagr_table = pd.DataFrame(cagr_rows).set_index("Fund")
            st.dataframe(cagr_table.style.format("{:.2f}%"), use_container_width=True)

        with col_hit:
            st.subheader("3Y Rolling Benchmark Hit Rate (%)")
            hit_data = []
            bench_rolling = compute_rolling_returns(aligned_df["benchmark_close"], window_years=3.0)
            
            for code in selected_codes:
                c_int = int(code)
                if c_int in aligned_df.columns:
                    fund_rolling = compute_rolling_returns(aligned_df[c_int], window_years=3.0)
                    hit = compute_benchmark_hit_rate(fund_rolling, bench_rolling)
                    name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                    hit_data.append({"Fund": name, "3Y Hit Rate (%)": hit})
                    
            df_hit = pd.DataFrame(hit_data)
            fig_hit = px.bar(
                df_hit, x="Fund", y="3Y Hit Rate (%)", text="3Y Hit Rate (%)",
                color="3Y Hit Rate (%)", color_continuous_scale="Viridis",
                range_y=[0, 105], template="plotly_dark", height=280
            )
            fig_hit.update_layout(margin=dict(l=10, r=10, t=10, b=10))
            st.plotly_chart(fig_hit, use_container_width=True)

        # Rolling Return Box Plot Distributions
        st.subheader("Rolling Return Distributions (3-Year & 5-Year CAGR)")
        roll_window = st.radio("Rolling Window", ["3-Year Rolling", "5-Year Rolling"], horizontal=True)
        w_yrs = 3.0 if "3" in roll_window else 5.0
        
        fig_box = go.Figure()
        for code in selected_codes:
            c_int = int(code)
            if c_int in aligned_df.columns:
                name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                r_series = compute_rolling_returns(aligned_df[c_int], window_years=w_yrs) * 100.0
                if not r_series.empty:
                    fig_box.add_trace(go.Box(y=r_series, name=name, boxpoints="outliers"))
                    
        bench_r = compute_rolling_returns(aligned_df["benchmark_close"], window_years=w_yrs) * 100.0
        if not bench_r.empty:
            fig_box.add_trace(go.Box(
                y=bench_r, name=f"Benchmark ({BENCHMARK_SYMBOLS[bench_symbol]})",
                marker_color="#f59e0b", boxpoints="outliers"
            ))

        fig_box.update_layout(
            template="plotly_dark", height=380,
            yaxis_title="Annualized Rolling CAGR (%)",
            margin=dict(l=20, r=20, t=20, b=20)
        )
        st.plotly_chart(fig_box, use_container_width=True)

    # ==========================================
    # TAB 2: Risk & Alpha
    # ==========================================
    with tab2:
        st.subheader("Quantitative Risk & Capital Market Line Summary")
        
        daily_returns = aligned_df.pct_change().dropna()
        bench_ret = daily_returns["benchmark_close"]
        
        risk_records = []
        for code in selected_codes:
            c_int = int(code)
            if c_int in daily_returns.columns:
                f_ret = daily_returns[c_int]
                f_price = aligned_df[c_int]
                name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                
                r_ratios = compute_risk_ratios(f_ret, rf_annual=rf_rate)
                cml = compute_cml_metrics(f_ret, bench_ret, rf_annual=rf_rate)
                active = compute_active_metrics(f_ret, bench_ret)
                dd = compute_drawdowns(f_price)
                
                risk_records.append({
                    "Fund": name,
                    "CAGR (%)": r_ratios["annualized_return"],
                    "Volatility (%)": r_ratios["volatility"],
                    "Sharpe": r_ratios["sharpe"],
                    "Sortino": r_ratios["sortino"],
                    "Beta": cml["beta"],
                    "Jensen Alpha (%)": cml["alpha"],
                    "R²": cml["r2"],
                    "Tracking Error (%)": active["tracking_error"],
                    "Info Ratio": active["information_ratio"],
                    "Max DD (%)": dd["max_drawdown"],
                    "Recovery (Days)": dd["recovery_days"]
                })
                
        df_risk = pd.DataFrame(risk_records).set_index("Fund")
        st.dataframe(df_risk.style.highlight_max(subset=["Sharpe", "Sortino", "Jensen Alpha (%)", "Info Ratio"], color="#065f46"), use_container_width=True)

        col_scatter, col_dd = st.columns([1, 1])

        with col_scatter:
            st.subheader("Beta vs. Jensen's Alpha (Bubble = Information Ratio)")
            fig_bubble = px.scatter(
                df_risk.reset_index(),
                x="Beta", y="Jensen Alpha (%)",
                size=[max(0.1, abs(x)) * 15 for x in df_risk["Info Ratio"]],
                color="Sharpe",
                hover_name="Fund",
                text="Fund",
                color_continuous_scale="Tealgrn",
                template="plotly_dark",
                height=380
            )
            fig_bubble.add_hline(y=0, line_dash="dash", line_color="#94a3b8")
            fig_bubble.add_vline(x=1.0, line_dash="dash", line_color="#94a3b8")
            fig_bubble.update_traces(textposition="top center")
            fig_bubble.update_layout(margin=dict(l=20, r=20, t=20, b=20))
            st.plotly_chart(fig_bubble, use_container_width=True)

        with col_dd:
            st.subheader("Peak-to-Trough Drawdown Curves (%)")
            fig_dd = go.Figure()
            for code in selected_codes:
                c_int = int(code)
                if c_int in aligned_df.columns:
                    name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                    dd_info = compute_drawdowns(aligned_df[c_int])
                    fig_dd.add_trace(go.Scatter(
                        x=dd_info["drawdown_series"].index,
                        y=dd_info["drawdown_series"] * 100.0,
                        mode="lines", name=name, line=dict(width=1.5)
                    ))
            fig_dd.update_layout(
                template="plotly_dark", height=380,
                yaxis_title="Drawdown (%)",
                margin=dict(l=20, r=20, t=20, b=20)
            )
            st.plotly_chart(fig_dd, use_container_width=True)

    # ==========================================
    # TAB 3: Portfolio Overlap & Sector Engine
    # ==========================================
    with tab3:
        st.subheader("Pairwise ISIN-Level Portfolio Overlap Matrix (%)")
        st.caption("Overlap = Sum_{shared ISIN} min(Weight_Fund_A, Weight_Fund_B). Cash collateral excluded.")
        
        overlap_mtx = compute_overlap_matrix(selected_codes)
        # Rename matrix columns with fund names
        rename_map = {str(c): PRESET_FUNDS.get(str(c), {}).get("name", f"Scheme {c}") for c in selected_codes}
        named_mtx = overlap_mtx.rename(index=rename_map, columns=rename_map)
        
        fig_heat = px.imshow(
            named_mtx,
            text_auto=True,
            color_continuous_scale="Blues",
            template="plotly_dark",
            height=360
        )
        fig_heat.update_layout(margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig_heat, use_container_width=True)

        col_mcap, col_sec = st.columns([1, 1])

        with col_mcap:
            st.subheader("Look-Through Market-Cap Allocation")
            mcap_series = aggregate_market_cap_exposure(selected_codes)
            df_mcap = mcap_series.reset_index()
            df_mcap.columns = ["Segment", "Weight (%)"]
            
            fig_pie = px.pie(
                df_mcap, names="Segment", values="Weight (%)",
                color_discrete_sequence=["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"],
                template="plotly_dark", height=320
            )
            fig_pie.update_layout(margin=dict(l=10, r=10, t=10, b=10))
            st.plotly_chart(fig_pie, use_container_width=True)

        with col_sec:
            st.subheader("Sector Concentration (Look-Through %)")
            sec_series = aggregate_sector_exposure(selected_codes).head(8)
            df_sec = sec_series.reset_index()
            df_sec.columns = ["Sector", "Weight (%)"]
            
            fig_sec = px.bar(
                df_sec, x="Weight (%)", y="Sector", orientation="h",
                color="Weight (%)", color_continuous_scale="Teal",
                template="plotly_dark", height=320
            )
            fig_sec.update_layout(yaxis=dict(autorange="reversed"), margin=dict(l=10, r=10, t=10, b=10))
            st.plotly_chart(fig_sec, use_container_width=True)

        # Shared holdings explorer
        if len(selected_codes) >= 2:
            st.subheader("Pairwise Common Holdings Explorer")
            c1, c2 = st.columns(2)
            f1 = c1.selectbox("Fund A", selected_codes, format_func=lambda x: PRESET_FUNDS.get(str(x), {}).get("name", x), key="pair_1")
            f2 = c2.selectbox("Fund B", [c for c in selected_codes if c != f1] or selected_codes, format_func=lambda x: PRESET_FUNDS.get(str(x), {}).get("name", x), key="pair_2")
            
            shared_df = get_top_shared_holdings(f1, f2)
            if not shared_df.empty:
                st.dataframe(shared_df, use_container_width=True)
            else:
                st.info("No common equity holdings detected between selected funds.")

    # ==========================================
    # TAB 4: Debt & Stress Testing
    # ==========================================
    with tab4:
        st.subheader("Liquidity Stress Testing (30-Day ADTV Baseline)")
        st.caption(f"Calculated assuming a conservative {adtv_participation*100:.0f}% volume participation cap without price dislocation.")
        
        target_stress_code = st.selectbox(
            "Select Fund for Detailed Liquidity & Stress Analysis",
            selected_codes,
            format_func=lambda x: PRESET_FUNDS.get(str(x), {}).get("name", x)
        )
        
        fund_meta = PRESET_FUNDS.get(str(target_stress_code), {})
        aum = fund_meta.get("aum_cr", 25000.0)
        h_df = get_fund_holdings_df(target_stress_code)
        
        liq_results = calculate_liquidity_stress(h_df, aum_crores=aum, participation_rate=adtv_participation)
        
        c_l1, c_l2, c_l3, c_l4 = st.columns(4)
        c_l1.metric("AUM Analyzed", f"₹{aum:,.0f} Cr")
        c_l2.metric("Days to Liquidate 25%", f"{liq_results['days_25_waterfall']} Days", f"Pro-rata: {liq_results['days_25_prorata']}d")
        c_l3.metric("Days to Liquidate 50%", f"{liq_results['days_50_waterfall']} Days", f"Pro-rata: {liq_results['days_50_prorata']}d")
        c_l4.metric("Illiquid (>10 Days)", f"{liq_results['pct_illiquid_over_10_days']:.1f}%")

        st.dataframe(liq_results["holdings_analysis"], use_container_width=True)

        st.markdown("---")
        st.subheader("Debt Duration Sensitivity & Yield Curve Shocks")
        
        col_d1, col_d2 = st.columns([1, 1])
        
        with col_d1:
            mac_dur = st.number_input("Macaulay Duration (Years)", value=float(fund_meta.get("macaulay_duration", 3.85)), step=0.25)
            fund_ytm = st.number_input("Current Portfolio YTM (%)", value=float(fund_meta.get("ytm", 0.0745) * 100.0), step=0.1) / 100.0
            convexity = st.number_input("Convexity", value=25.0, step=1.0)
            
            # Yield curve shock grid
            dur_df = calculate_duration_sensitivity(macaulay_duration=mac_dur, current_ytm=fund_ytm, convexity=convexity)
            st.dataframe(dur_df[["shock_bps", "duration_impact_pct", "convexity_impact_pct", "total_nav_change_pct", "simulated_nav"]].style.format({
                "duration_impact_pct": "{:.2f}%",
                "convexity_impact_pct": "{:.3f}%",
                "total_nav_change_pct": "{:.2f}%",
                "simulated_nav": "₹{:.2f}"
            }), use_container_width=True)

        with col_d2:
            st.markdown("##### Interactive Rate Shock Simulator")
            shock_slider = st.slider("Parallel Yield Curve Shift (bps)", min_value=-250, max_value=250, value=50, step=25)
            
            shock_sim = simulate_custom_rate_shock(
                macaulay_duration=mac_dur, current_ytm=fund_ytm, custom_bps=shock_slider, convexity=convexity
            )
            
            nav_delta = shock_sim["total_nav_change_pct"]
            st.metric(
                label=f"Simulated NAV Impact ({shock_slider:+d} bps)",
                value=f"{nav_delta:+.2f}%",
                delta=f"New NAV: ₹{shock_sim['simulated_nav']:.2f}"
            )
            
            st.write(f"- **Modified Duration:** {shock_sim['modified_duration']:.2f} yrs")
            st.write(f"- **First-Order Duration Effect:** {shock_sim['duration_impact_pct']:+.2f}%")
            st.write(f"- **Second-Order Convexity Benefit:** {shock_sim['convexity_benefit_pct']:+.3f}%")

    # ==========================================
    # TAB 5: Python Code Suite
    # ==========================================
    with tab5:
        st.subheader("Modular Python Source Files")
        st.info("All 5 modules are saved in the project root and can be executed locally with `streamlit run app.py`.")
        
        file_to_view = st.selectbox(
            "Select Module to Inspect",
            ["app.py", "quant_engine.py", "data_loader.py", "overlap_engine.py", "stress_test.py", "requirements.txt"]
        )
        
        try:
            with open(file_to_view, "r", encoding="utf-8") as f:
                code_text = f.read()
            st.code(code_text, language="python" if file_to_view.endswith(".py") else "text")
        except Exception as e:
            st.error(f"Could not read file {file_to_view}: {e}")


if __name__ == "__main__":
    main()
