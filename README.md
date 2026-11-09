# Indian Mutual Funds Quantitative & Risk Analytics Engine

A production-grade, interactive quantitative analytics suite for Indian Mutual Funds built with Python, Streamlit, Pandas, NumPy, SQLite, and Plotly, paired with a web dashboard.

## Architecture

- **`data_loader.py`**: Dynamic NAV ingestion from `https://api.mfapi.in/mf/{scheme_code}`, benchmark ingestion via `yfinance`, normalized in SQLite `:memory:` database with aligned forward-filling.
- **`quant_engine.py`**: Vectorized CAGR (1Y, 3Y, 5Y, 7Y), 3Y/5Y rolling returns distributions, rolling benchmark hit rate, Sharpe, Sortino, Beta, Jensen's Alpha, R², Tracking Error, Information Ratio, Maximum Drawdown, and peak recovery period.
- **`overlap_engine.py`**: Weighted ISIN overlap $\sum \min(W_{A, i}, W_{B, i})$, $N \times N$ matrix, look-through market cap & sector exposures, and common holding inspector.
- **`stress_test.py`**: 30-day ADTV liquidity stress testing (days to liquidate 25% and 50% under 10% volume participation constraint) and Macaulay/Modified duration sensitivity with yield curve shocks.
- **`app.py`**: Streamlit interactive dashboard.

## Running Locally

1. Create a virtual environment and install requirements:
```bash
pip install -r requirements.txt
```

2. Run the Streamlit dashboard:
```bash
streamlit run app.py
```
