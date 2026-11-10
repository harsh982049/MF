"""
Module 5: Streamlit Frontend & Visualizations (app.py)
Interactive Quantitative Dashboard for Indian Mutual Funds.
Run with: streamlit run app.py
"""

from datetime import datetime, timedelta
import pandas as pd
import numpy as np

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
    search_mfapi_schemes,
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

    # Sidebar Controls
    st.sidebar.title("Portfolio Settings")
    st.sidebar.markdown("---")

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
    
    selected_codes = [fund_options[l] for l in selected_labels]

    # Live Search across all 38,000+ mutual fund schemes from mfapi.in
    st.sidebar.markdown("**Universal MF Search (mfapi.in)**")
    search_q = st.sidebar.text_input("Search 38,000+ Schemes by Name", placeholder="e.g. Mirae, SBI Small, Quant, Gold", key="mfapi_search_box")
    if search_q.strip() and len(search_q.strip()) >= 2:
        results = search_mfapi_schemes(search_q.strip())
        if results:
            options_map = {f"{r['schemeName']} ({r['schemeCode']})": str(r['schemeCode']) for r in results[:25]}
            chosen = st.sidebar.selectbox("Matching Schemes from mfapi.in:", ["-- Click to add --"] + list(options_map.keys()))
            if chosen != "-- Click to add --":
                chosen_code = options_map[chosen]
                if chosen_code not in selected_codes:
                    selected_codes.append(chosen_code)
                    st.sidebar.success(f"Added {chosen} to comparison!")
        else:
            st.sidebar.info("No schemes found on mfapi.in matching query.")

    custom_code = st.sidebar.text_input("Or Enter Direct Scheme Code", placeholder="e.g. 120503")
    if custom_code.strip() and custom_code.strip().isdigit():
        c_code = custom_code.strip()
        if c_code not in selected_codes:
            selected_codes.append(c_code)

    if not selected_codes:
        st.warning("Please select at least one mutual fund scheme from the sidebar.")
        return

    bench_symbol = st.sidebar.selectbox(
        "Benchmark Index",
        options=list(BENCHMARK_SYMBOLS.keys()),
        format_func=lambda s: f"{BENCHMARK_SYMBOLS[s]} ({s})",
        index=1
    )

    horizon_years = st.sidebar.selectbox("Historical Horizon", [1, 3, 5, 7, 10, 12], index=2)
    rf_rate = st.sidebar.slider("Risk-Free Rate (Rf %)", min_value=4.0, max_value=9.0, value=6.5, step=0.25) / 100.0
    adtv_participation = st.sidebar.slider("ADTV Participation Rate (%)", min_value=5, max_value=30, value=10, step=5) / 100.0

    st.title("Indian Mutual Funds Quantitative Risk & Overlap Engine")
    st.markdown(f"**Benchmark:** {BENCHMARK_SYMBOLS[bench_symbol]} · **Risk-Free Rate:** {rf_rate*100:.2f}% · **Liquidity Participation:** {adtv_participation*100:.0f}% ADTV")

    with st.spinner("Ingesting NAV series and calculating aligned time-series..."):
        aligned_df = get_aligned_fund_and_benchmark(selected_codes, bench_symbol, years=horizon_years)

    if aligned_df.empty:
        st.error("Failed to load historical price series. Please verify network connection or scheme codes.")
        return

    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "Performance & Rolling",
        "Risk & Capital Market Metrics",
        "Portfolio Overlap & Holdings",
        "Liquidity & Duration Stress",
        "Factsheets & Qualitative",
        "Python Code Suite & Data Export"
    ])

    # TAB 1: Performance & Rolling
    with tab1:
        st.subheader("Cumulative Growth (Rebased to 100)")
        rebased_df = (aligned_df / aligned_df.iloc[0]) * 100.0
        
        fig_cum = go.Figure()
        for code in selected_codes:
            c_int = int(code)
            if c_int in rebased_df.columns:
                name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                fig_cum.add_trace(go.Scatter(x=rebased_df.index, y=rebased_df[c_int], mode="lines", name=name, line=dict(width=2)))
                
        if "benchmark_close" in rebased_df.columns:
            fig_cum.add_trace(go.Scatter(
                x=rebased_df.index, y=rebased_df["benchmark_close"],
                mode="lines", name=f"Benchmark ({BENCHMARK_SYMBOLS[bench_symbol]})",
                line=dict(color="#f59e0b", width=2.5, dash="dash")
            ))
            
        fig_cum.update_layout(template="plotly_dark", height=420, margin=dict(l=20, r=20, t=20, b=20), hovermode="x unified", yaxis_title="Growth (Base = 100)")
        st.plotly_chart(fig_cum, use_container_width=True)

        col_cagr, col_hit = st.columns([1, 1])

        with col_cagr:
            st.subheader("Trailing CAGR (%) Matrix")
            cagr_rows = []
            for code in selected_codes:
                c_int = int(code)
                if c_int in aligned_df.columns:
                    name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                    cagr_dict = compute_trailing_cagr(aligned_df[c_int], [1, 3, 5, 7, 10])
                    cagr_dict["Fund"] = name
                    cagr_rows.append(cagr_dict)
            
            if "benchmark_close" in aligned_df.columns:
                bench_cagr = compute_trailing_cagr(aligned_df["benchmark_close"], [1, 3, 5, 7, 10])
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
            fig_hit = px.bar(df_hit, x="Fund", y="3Y Hit Rate (%)", text="3Y Hit Rate (%)", color="3Y Hit Rate (%)", color_continuous_scale="Viridis", range_y=[0, 105], template="plotly_dark", height=280)
            fig_hit.update_layout(margin=dict(l=10, r=10, t=10, b=10))
            st.plotly_chart(fig_hit, use_container_width=True)

        # Statistical Rolling Distribution Table
        st.subheader("Rolling Return Statistical Distribution Table")
        roll_window = st.radio("Rolling Window", ["1-Year Rolling", "3-Year Rolling", "5-Year Rolling"], horizontal=True, index=1)
        w_yrs = 1.0 if "1" in roll_window else (3.0 if "3" in roll_window else 5.0)

        dist_records = []
        for code in selected_codes:
            c_int = int(code)
            if c_int in aligned_df.columns:
                name = PRESET_FUNDS.get(str(code), {}).get("name", f"Scheme {code}")
                r_series = compute_rolling_returns(aligned_df[c_int], window_years=w_yrs)
                stats = compute_rolling_distribution_stats(r_series)
                stats["Fund"] = name
                dist_records.append(stats)

        b_roll = compute_rolling_returns(aligned_df["benchmark_close"], window_years=w_yrs)
        b_stats = compute_rolling_distribution_stats(b_roll)
        b_stats["Fund"] = f"Benchmark ({BENCHMARK_SYMBOLS[bench_symbol]})"
        dist_records.append(b_stats)

        df_dist = pd.DataFrame(dist_records).set_index("Fund")
        st.dataframe(df_dist[["mean", "median", "min", "max", "q25", "q75", "std", "pct_positive"]].rename(columns={
            "mean": "Mean (%)", "median": "Median (%)", "min": "Worst (%)", "max": "Best (%)",
            "q25": "25%ile", "q75": "75%ile", "std": "Std Dev", "pct_positive": "% Positive Windows"
        }), use_container_width=True)

    # TAB 2: Risk & Alpha
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
                    "Calmar": dd["calmar_ratio"],
                    "Up Capture (%)": active["upside_capture"],
                    "Down Capture (%)": active["downside_capture"],
                    "Max DD (%)": dd["max_drawdown"],
                    "Recovery (Days)": dd["recovery_days"]
                })
                
        df_risk = pd.DataFrame(risk_records).set_index("Fund")
        st.dataframe(df_risk.style.highlight_max(subset=["Sharpe", "Sortino", "Jensen Alpha (%)", "Info Ratio", "Calmar"], color="#065f46"), use_container_width=True)

        col_scatter, col_capture = st.columns([1, 1])

        with col_scatter:
            st.subheader("Beta vs. Jensen's Alpha (Bubble = Info Ratio)")
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

        with col_capture:
            st.subheader("Upside vs. Downside Capture Ratio")
            fig_cap = px.scatter(
                df_risk.reset_index(),
                x="Down Capture (%)", y="Up Capture (%)",
                hover_name="Fund", text="Fund",
                color="Sharpe", color_continuous_scale="Viridis",
                template="plotly_dark", height=380
            )
            fig_cap.add_hline(y=100, line_dash="dash", line_color="#f59e0b")
            fig_cap.add_vline(x=100, line_dash="dash", line_color="#f59e0b")
            fig_cap.update_traces(textposition="top center")
            fig_cap.update_layout(margin=dict(l=20, r=20, t=20, b=20))
            st.plotly_chart(fig_cap, use_container_width=True)

    # TAB 3: Overlap & Sectors
    with tab3:
        st.subheader("Pairwise ISIN-Level Portfolio Overlap Matrix (%)")
        overlap_mtx = compute_overlap_matrix(selected_codes)
        rename_map = {str(c): PRESET_FUNDS.get(str(c), {}).get("name", f"Scheme {c}") for c in selected_codes}
        named_mtx = overlap_mtx.rename(index=rename_map, columns=rename_map)
        
        fig_heat = px.imshow(named_mtx, text_auto=True, color_continuous_scale="Blues", template="plotly_dark", height=380)
        fig_heat.update_layout(margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig_heat, use_container_width=True)

        col_mcap, col_sec = st.columns([1, 1])
        with col_mcap:
            st.subheader("Look-Through Market-Cap Allocation")
            mcap_series = aggregate_market_cap_exposure(selected_codes)
            df_mcap = mcap_series.reset_index()
            df_mcap.columns = ["Segment", "Weight (%)"]
            fig_pie = px.pie(df_mcap, names="Segment", values="Weight (%)", color_discrete_sequence=["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#64748b"], template="plotly_dark", height=320)
            st.plotly_chart(fig_pie, use_container_width=True)

        with col_sec:
            st.subheader("Top Sector Concentrations")
            sec_series = aggregate_sector_exposure(selected_codes).head(8)
            df_sec = sec_series.reset_index()
            df_sec.columns = ["Sector", "Weight (%)"]
            fig_sec = px.bar(df_sec, x="Weight (%)", y="Sector", orientation="h", color="Weight (%)", color_continuous_scale="Teal", template="plotly_dark", height=320)
            fig_sec.update_layout(yaxis=dict(autorange="reversed"), margin=dict(l=10, r=10, t=10, b=10))
            st.plotly_chart(fig_sec, use_container_width=True)

    # TAB 4: Debt & Stress Testing
    with tab4:
        st.subheader("Portfolio Liquidity Stress Testing (30-Day ADTV Baseline)")
        target_stress_code = st.selectbox("Select Fund for Liquidity Analysis", selected_codes, format_func=lambda x: PRESET_FUNDS.get(str(x), {}).get("name", x))
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
            dur_df = calculate_duration_sensitivity(macaulay_duration=mac_dur, current_ytm=fund_ytm)
            st.dataframe(dur_df[["shock_bps", "duration_impact_pct", "convexity_impact_pct", "total_nav_change_pct", "simulated_nav"]].style.format({
                "duration_impact_pct": "{:.2f}%", "convexity_impact_pct": "{:.3f}%", "total_nav_change_pct": "{:.2f}%", "simulated_nav": "₹{:.2f}"
            }), use_container_width=True)
        with col_d2:
            shock_slider = st.slider("Parallel Yield Curve Shift (bps)", min_value=-250, max_value=250, value=50, step=25)
            shock_sim = simulate_custom_rate_shock(macaulay_duration=mac_dur, current_ytm=fund_ytm, custom_bps=shock_slider)
            st.metric(label=f"Simulated NAV Impact ({shock_slider:+d} bps)", value=f"{shock_sim['total_nav_change_pct']:+.2f}%", delta=f"New NAV: ₹{shock_sim['simulated_nav']:.2f}")

    # TAB 5: Factsheets & Qualitative
    with tab5:
        st.subheader("Mutual Fund Factsheets & Manager Track Record")
        for code in selected_codes:
            meta = PRESET_FUNDS.get(str(code), {})
            if meta:
                with st.expander(f"{meta['name']} ({meta['category']}) - AUM: ₹{meta.get('aum_cr', 0):,.0f} Cr"):
                    c1, c2, c3 = st.columns(3)
                    c1.write(f"**Fund House:** {meta.get('fund_house', '-')}")
                    c1.write(f"**Asset Class:** {meta.get('asset_class', 'Equity')}")
                    c2.write(f"**Expense Ratio (Direct):** {meta.get('expense_ratio', '-')}%")
                    c2.write(f"**Lead Manager:** {meta.get('manager', '-')}")
                    c3.write(f"**ISIN:** `{meta.get('isin', '-')}`")
                    c3.write(f"**Benchmark:** {meta.get('benchmark', '-')}")
                    st.write("**Top Holdings:**")
                    st.dataframe(get_fund_holdings_df(code).head(8), use_container_width=True)

    # TAB 6: Code Suite & Data Export
    with tab6:
        st.subheader("Data Export & Source Modules")
        c_exp1, c_exp2 = st.columns(2)
        with c_exp1:
            st.download_button(
                label="📥 Download Comparison Summary (CSV)",
                data=df_risk.to_csv(),
                file_name=f"mutual_funds_comparison_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )
        with c_exp2:
            st.download_button(
                label="📥 Download Daily NAV Matrix (CSV)",
                data=aligned_df.to_csv(),
                file_name=f"mutual_funds_daily_nav_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )


if __name__ == "__main__":
    main()
