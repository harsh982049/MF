/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShieldAlert,
  Layers,
  Activity,
  Code2,
  Sliders,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Clock,
  Briefcase,
} from 'lucide-react';

import { FundMeta, NavPoint, RiskMetrics } from './types/quant';
import {
  PRESET_FUNDS,
  BENCHMARKS,
  generateBenchmarkSeries,
  fetchLiveMfNav,
} from './data/presetFunds';
import {
  computeTrailingCagr,
  computeRollingReturns,
  computeBenchmarkHitRate,
  computeComprehensiveMetrics,
  computeOverlapMatrix,
  aggregateMarketCapExposure,
  aggregateSectorExposure,
  calculateLiquidityStress,
  calculateDurationSensitivity,
  computePairwiseOverlap,
} from './utils/quantEngine';
import {
  PerformanceChart,
  RollingBoxPlot,
  BubbleScatterPlot,
  OverlapHeatmap,
} from './components/QuantVisuals';
import { PythonExporter } from './components/PythonExporter';

const COLOR_PALETTE = [
  '#38bdf8', // Sky Blue
  '#34d399', // Emerald
  '#f472b6', // Pink
  '#a78bfa', // Purple
  '#fb923c', // Orange
  '#e879f9', // Fuchsia
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'perf' | 'risk' | 'overlap' | 'stress' | 'python'>('perf');

  // Sidebar Controls
  const [selectedCodes, setSelectedCodes] = useState<number[]>([122639, 127042, 118989, 118778]);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('^CRSLDX');
  const [timeHorizon, setTimeHorizon] = useState<number>(5);
  const [rfRate, setRfRate] = useState<number>(6.5);
  const [adtvParticipation, setAdtvParticipation] = useState<number>(10);
  const [customCodeInput, setCustomCodeInput] = useState<string>('');
  const [customFunds, setCustomFunds] = useState<Record<number, FundMeta>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Time-Series Nav Storage
  const [fundSeriesMap, setFundSeriesMap] = useState<Record<number, NavPoint[]>>({});
  const [rollingWindowYears, setRollingWindowYears] = useState<number>(3);

  // Stress test fund selection
  const [stressFundCode, setStressFundCode] = useState<number>(122639);
  const [customRateShockBps, setCustomRateShockBps] = useState<number>(50);

  // Overlap drill-down selection
  const [overlapPair, setOverlapPair] = useState<[number, number]>([122639, 127042]);

  // Combined universe of preset + custom added funds
  const allFunds = useMemo(() => {
    return { ...PRESET_FUNDS, ...customFunds };
  }, [customFunds]);

  // Fetch or calibrate series on fund selection or horizon change
  useEffect(() => {
    let isMounted = true;
    setIsRefreshing(true);

    const loadSeries = async () => {
      const newMap: Record<number, NavPoint[]> = {};
      for (const code of selectedCodes) {
        const series = await fetchLiveMfNav(code);
        newMap[code] = series;
      }
      if (isMounted) {
        setFundSeriesMap(newMap);
        setIsRefreshing(false);
      }
    };

    loadSeries();

    return () => {
      isMounted = false;
    };
  }, [selectedCodes, timeHorizon]);

  // Benchmark Series
  const benchmarkSeries = useMemo(() => {
    return generateBenchmarkSeries(benchmarkSymbol, timeHorizon);
  }, [benchmarkSymbol, timeHorizon]);

  const activeBenchmark = useMemo(() => {
    return BENCHMARKS.find((b) => b.symbol === benchmarkSymbol) || BENCHMARKS[0];
  }, [benchmarkSymbol]);

  // Handle adding custom scheme code
  const handleAddCustomScheme = async () => {
    const code = parseInt(customCodeInput.trim(), 10);
    if (!code || isNaN(code)) return;

    if (!allFunds[code]) {
      setIsRefreshing(true);
      try {
        const resp = await fetch(`https://api.mfapi.in/mf/${code}`);
        if (resp.ok) {
          const json = await resp.json();
          const meta = json.meta;
          const newFund: FundMeta = {
            scheme_code: code,
            name: meta.scheme_name || `Scheme ${code}`,
            category: meta.scheme_category || 'Equity Fund',
            benchmark_symbol: benchmarkSymbol,
            isin: meta.isin_growth || `INF${code}`,
            aum_cr: 15000,
            macaulay_duration: 0,
            holdings: PRESET_FUNDS[118989].holdings, // inherit representative large-cap basket
          };
          setCustomFunds((prev) => ({ ...prev, [code]: newFund }));
        }
      } catch {
        // Fallback placeholder fund
        const fallbackFund: FundMeta = {
          scheme_code: code,
          name: `Custom Scheme ${code}`,
          category: 'Flexi Cap',
          benchmark_symbol: benchmarkSymbol,
          isin: `INF${code}`,
          aum_cr: 10000,
          macaulay_duration: 0,
          holdings: PRESET_FUNDS[122639].holdings,
        };
        setCustomFunds((prev) => ({ ...prev, [code]: fallbackFund }));
      }
    }

    if (!selectedCodes.includes(code)) {
      setSelectedCodes((prev) => [...prev, code]);
    }
    setCustomCodeInput('');
  };

  const handleToggleFund = (code: number) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length > 1) {
        setSelectedCodes(selectedCodes.filter((c) => c !== code));
      }
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  // Trailing CAGR Matrix
  const trailingCagrMatrix = useMemo(() => {
    return selectedCodes.map((code) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      const cagr = computeTrailingCagr(series, [1, 3, 5, 7]);
      return {
        code,
        name: fund?.name || `Scheme ${code}`,
        cagr,
      };
    });
  }, [selectedCodes, allFunds, fundSeriesMap]);

  const benchmarkCagr = useMemo(() => {
    return computeTrailingCagr(benchmarkSeries, [1, 3, 5, 7]);
  }, [benchmarkSeries]);

  // Rolling Return Distributions & Hit Rates
  const rollingAnalysis = useMemo(() => {
    const benchRolling = computeRollingReturns(benchmarkSeries, rollingWindowYears);

    const fundsRolling = selectedCodes.map((code, idx) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      const dist = computeRollingReturns(series, rollingWindowYears);
      const hitRate = computeBenchmarkHitRate(dist.series, benchRolling.series);
      return {
        code,
        name: fund?.name || `Scheme ${code}`,
        dist,
        hitRate,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      };
    });

    return {
      benchDist: benchRolling,
      fundsRolling,
    };
  }, [selectedCodes, allFunds, fundSeriesMap, benchmarkSeries, rollingWindowYears]);

  // Comprehensive Risk Metrics (Alpha, Beta, Sharpe, Sortino, IR, Drawdowns)
  const riskMetricsList: RiskMetrics[] = useMemo(() => {
    return selectedCodes.map((code) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      return computeComprehensiveMetrics(
        series,
        benchmarkSeries,
        fund?.name || `Scheme ${code}`,
        code,
        rfRate / 100.0
      );
    });
  }, [selectedCodes, allFunds, fundSeriesMap, benchmarkSeries, rfRate]);

  // Overlap Matrix & Exposures
  const overlapData = useMemo(() => {
    const fundsList = selectedCodes.map((code) => ({
      scheme_code: code,
      name: allFunds[code]?.name || `Scheme ${code}`,
      holdings: allFunds[code]?.holdings || [],
    }));

    const matrixRes = computeOverlapMatrix(fundsList);
    const mcapExposure = aggregateMarketCapExposure(fundsList);
    const sectorExposure = aggregateSectorExposure(fundsList);

    return {
      names: matrixRes.names,
      matrix: matrixRes.matrix,
      mcapExposure,
      sectorExposure,
    };
  }, [selectedCodes, allFunds]);

  // Shared holdings for selected pair
  const sharedHoldings = useMemo(() => {
    const [c1, c2] = overlapPair;
    const h1 = allFunds[c1]?.holdings || [];
    const h2 = allFunds[c2]?.holdings || [];

    const map2 = new Map(h2.map((h) => [h.isin, h]));
    const common: {
      isin: string;
      name: string;
      sector: string;
      mcap: string;
      w1: number;
      w2: number;
      overlapContrib: number;
    }[] = [];

    h1.forEach((stock) => {
      if (stock.isin === 'CASH_EQUIV') return;
      const match = map2.get(stock.isin);
      if (match) {
        common.push({
          isin: stock.isin,
          name: stock.name,
          sector: stock.sector,
          mcap: stock.mcap,
          w1: stock.weight,
          w2: match.weight,
          overlapContrib: Math.min(stock.weight, match.weight),
        });
      }
    });

    return common.sort((a, b) => b.overlapContrib - a.overlapContrib);
  }, [overlapPair, allFunds]);

  // Stress Testing Target Fund
  const targetStressFund = useMemo(() => {
    return allFunds[stressFundCode] || allFunds[selectedCodes[0]] || PRESET_FUNDS[122639];
  }, [stressFundCode, allFunds, selectedCodes]);

  const liquidityResult = useMemo(() => {
    return calculateLiquidityStress(
      targetStressFund.holdings,
      targetStressFund.aum_cr,
      adtvParticipation / 100.0
    );
  }, [targetStressFund, adtvParticipation]);

  const durationShocks = useMemo(() => {
    return calculateDurationSensitivity(
      targetStressFund.macaulay_duration || 3.85,
      targetStressFund.ytm || 0.0745,
      24.5
    );
  }, [targetStressFund]);

  // Interactive custom rate shock calculation
  const customShockResult = useMemo(() => {
    const macDur = targetStressFund.macaulay_duration || 3.85;
    const ytm = targetStressFund.ytm || 0.0745;
    const modDur = macDur / (1.0 + ytm);
    const deltaY = customRateShockBps / 10000.0;
    const durImpact = -modDur * deltaY;
    const cvxImpact = 0.5 * 24.5 * Math.pow(deltaY, 2);
    const totalImpact = durImpact + cvxImpact;
    return {
      modDur,
      durImpactPct: durImpact * 100,
      cvxBenefitPct: cvxImpact * 100,
      totalImpactPct: totalImpact * 100,
      simulatedNav: 100.0 * (1.0 + totalImpact),
    };
  }, [targetStressFund, customRateShockBps]);

  // Named performance map for line chart
  const namedPerfMap = useMemo(() => {
    const res: Record<string, NavPoint[]> = {};
    selectedCodes.forEach((code) => {
      const name = allFunds[code]?.name || `Scheme ${code}`;
      res[name] = fundSeriesMap[code] || [];
    });
    return res;
  }, [selectedCodes, allFunds, fundSeriesMap]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-900 selection:text-white">
      {/* Top Bar Contract (3 Zones: Brand Title, Nav Links, Primary CTA) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur sticky top-0 z-50">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
            ₹
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            Indian MF Quant Studio
          </span>
          <span className="text-xs text-slate-500 font-normal hidden sm:inline">
            · Institutional Analytics Engine
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('perf')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'perf' ? 'text-emerald-400 font-semibold underline underline-offset-4' : 'hover:text-white'
            }`}
          >
            Performance &amp; Rolling
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'risk' ? 'text-emerald-400 font-semibold underline underline-offset-4' : 'hover:text-white'
            }`}
          >
            Risk &amp; Alpha
          </button>
          <button
            onClick={() => setActiveTab('overlap')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'overlap' ? 'text-emerald-400 font-semibold underline underline-offset-4' : 'hover:text-white'
            }`}
          >
            Portfolio Overlap
          </button>
          <button
            onClick={() => setActiveTab('stress')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'stress' ? 'text-emerald-400 font-semibold underline underline-offset-4' : 'hover:text-white'
            }`}
          >
            Debt &amp; Stress
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'python' ? 'text-indigo-400 font-semibold underline underline-offset-4' : 'hover:text-white'
            }`}
          >
            Python Suite
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('python')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Export Python Suite</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Sidebar Controls + Central Workspace Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1720px] w-full mx-auto">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-72 p-5 bg-[#0f172a]/60 border-r border-slate-800/80 shrink-0 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                Active Funds ({selectedCodes.length})
              </span>
              <button
                onClick={() => setSelectedCodes([122639, 127042, 118989, 118778])}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Reset Curated
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {Object.values(allFunds).map((fund) => {
                const isSelected = selectedCodes.includes(fund.scheme_code);
                return (
                  <label
                    key={fund.scheme_code}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500/40 text-slate-100'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleFund(fund.scheme_code)}
                      className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{fund.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{fund.category}</span>
                        <span>·</span>
                        <span className="font-mono">{fund.scheme_code}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Add custom scheme */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Add Scheme Code (mfapi.in)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="e.g. 120503, 119598"
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomScheme()}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={handleAddCustomScheme}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-5 space-y-4">
            {/* Benchmark Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Benchmark Index
              </label>
              <select
                value={benchmarkSymbol}
                onChange={(e) => setBenchmarkSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
              >
                {BENCHMARKS.map((b) => (
                  <option key={b.symbol} value={b.symbol}>
                    {b.name} ({b.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Horizon */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold uppercase tracking-wider">Analysis Horizon</span>
                <span className="font-mono text-emerald-400">{timeHorizon} Years</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[1, 3, 5, 7].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setTimeHorizon(yr)}
                    className={`py-1 text-xs rounded font-mono transition-colors ${
                      timeHorizon === yr
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {yr}Y
                  </button>
                ))}
              </div>
            </div>

            {/* Risk-free Rate */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Risk-Free Rate (Rf)</span>
                <span className="font-mono text-indigo-400">{rfRate.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="9.0"
                step="0.25"
                value={rfRate}
                onChange={(e) => setRfRate(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500 mt-0.5">Indian 10Y Sovereign G-Sec benchmark</div>
            </div>

            {/* ADTV Liquidity Limit */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">ADTV Participation</span>
                <span className="font-mono text-amber-400">{adtvParticipation}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={adtvParticipation}
                onChange={(e) => setAdtvParticipation(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500 mt-0.5">Max daily market volume limit</div>
            </div>
          </div>

          <div className="pt-2">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Live Ingestion Engine
              </div>
              <div>mfapi.in dynamic NAV sync enabled with offline calibrated fallback.</div>
            </div>
          </div>
        </aside>

        {/* Central Dashboard Viewport */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Sub-Header Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('perf')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'perf'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Performance &amp; Rolling Returns</span>
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'risk'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Risk Ratios &amp; Alpha Engine</span>
            </button>
            <button
              onClick={() => setActiveTab('overlap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'overlap'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>ISIN Overlap &amp; Sectors</span>
            </button>
            <button
              onClick={() => setActiveTab('stress')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'stress'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Debt &amp; Liquidity Stress</span>
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'python'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Python Streamlit Suite</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: PERFORMANCE & ROLLING RETURNS                     */}
          {/* ========================================================= */}
          {activeTab === 'perf' && (
            <div className="space-y-6">
              {/* Cumulative Growth Chart */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Cumulative Performance (Rebased to 100)</h2>
                    <p className="text-xs text-slate-400">
                      Standardized normalized growth comparing fund trajectories against {activeBenchmark.name} over {timeHorizon} years.
                    </p>
                  </div>
                  {isRefreshing && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing NAVs...</span>
                    </div>
                  )}
                </div>

                <PerformanceChart
                  seriesMap={namedPerfMap}
                  benchSeries={benchmarkSeries}
                  benchName={activeBenchmark.name}
                  colors={COLOR_PALETTE}
                />
              </div>

              {/* Trailing CAGR & Hit Rate Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trailing CAGR Table */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-white mb-1">Trailing CAGR (%) Matrix</h3>
                  <p className="text-xs text-slate-400 mb-3">Annualized point-to-point Compound Annual Growth Rates.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-right">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-sans">
                          <th className="py-2 text-left font-medium">Scheme / Benchmark</th>
                          <th className="py-2 px-2 font-medium">1Y</th>
                          <th className="py-2 px-2 font-medium">3Y</th>
                          <th className="py-2 px-2 font-medium">5Y</th>
                          <th className="py-2 px-2 font-medium">7Y</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {trailingCagrMatrix.map((item) => (
                          <tr key={item.code} className="hover:bg-slate-800/40">
                            <td className="py-2.5 text-left font-sans text-slate-200 font-medium truncate max-w-[200px]">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-2 text-emerald-400 font-semibold">{item.cagr['1Y'] ?? '-'}%</td>
                            <td className="py-2.5 px-2 text-emerald-400 font-semibold">{item.cagr['3Y'] ?? '-'}%</td>
                            <td className="py-2.5 px-2 text-emerald-400 font-semibold">{item.cagr['5Y'] ?? '-'}%</td>
                            <td className="py-2.5 px-2 text-emerald-400 font-semibold">{item.cagr['7Y'] ?? '-'}%</td>
                          </tr>
                        ))}
                        <tr className="bg-amber-950/20 font-semibold border-t-2 border-slate-700">
                          <td className="py-2.5 text-left font-sans text-amber-300">
                            {activeBenchmark.name} (Bench)
                          </td>
                          <td className="py-2.5 px-2 text-amber-300">{benchmarkCagr['1Y'] ?? '-'}%</td>
                          <td className="py-2.5 px-2 text-amber-300">{benchmarkCagr['3Y'] ?? '-'}%</td>
                          <td className="py-2.5 px-2 text-amber-300">{benchmarkCagr['5Y'] ?? '-'}%</td>
                          <td className="py-2.5 px-2 text-amber-300">{benchmarkCagr['7Y'] ?? '-'}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Benchmark Hit Rate Cards */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-white">
                        {rollingWindowYears}Y Rolling Benchmark Hit Rate (%)
                      </h3>
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md text-xs font-mono">
                        <button
                          onClick={() => setRollingWindowYears(3)}
                          className={`px-2 py-0.5 rounded ${
                            rollingWindowYears === 3 ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400'
                          }`}
                        >
                          3Y
                        </button>
                        <button
                          onClick={() => setRollingWindowYears(5)}
                          className={`px-2 py-0.5 rounded ${
                            rollingWindowYears === 5 ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400'
                          }`}
                        >
                          5Y
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Percentage of rolling calendar windows where the fund outperformed {activeBenchmark.name}.
                    </p>

                    <div className="space-y-3">
                      {rollingAnalysis.fundsRolling.map((fund) => {
                        const hit = fund.hitRate;
                        return (
                          <div key={fund.code} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-medium truncate max-w-[220px]">
                                {fund.name}
                              </span>
                              <span className="font-mono font-bold text-emerald-400">{hit.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, hit))}%`,
                                  backgroundColor: hit > 75 ? '#10b981' : hit > 50 ? '#38bdf8' : '#f59e0b',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                    Calculated over {rollingAnalysis.benchDist.count} daily rolling windows. &gt; 70% denotes institutional persistence.
                  </div>
                </div>
              </div>

              {/* Rolling Return Distributions Box Plots */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {rollingWindowYears}-Year Rolling Return Distribution (CAGR %)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Statistical spread showing Minimum, 25th Percentile, Median, Mean, 75th Percentile, and Maximum.
                    </p>
                  </div>
                </div>

                <RollingBoxPlot
                  distributions={[
                    {
                      name: activeBenchmark.name,
                      dist: rollingAnalysis.benchDist,
                      color: '#f59e0b',
                    },
                    ...rollingAnalysis.fundsRolling.map((f) => ({
                      name: f.name,
                      dist: f.dist,
                      color: f.color,
                    })),
                  ]}
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: QUANTITATIVE RISK & ALPHA ENGINE                   */}
          {/* ========================================================= */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              {/* Comprehensive Risk Table */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">Risk-Adjusted Ratios &amp; Active Alpha</h2>
                    <p className="text-xs text-slate-400">
                      Evaluated against {activeBenchmark.name} at Risk-Free Rate = {rfRate.toFixed(2)}%.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-right">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-sans">
                        <th className="py-2.5 text-left font-medium">Scheme</th>
                        <th className="py-2.5 px-2 font-medium">CAGR</th>
                        <th className="py-2.5 px-2 font-medium">Volatility</th>
                        <th className="py-2.5 px-2 font-medium">Sharpe</th>
                        <th className="py-2.5 px-2 font-medium">Sortino</th>
                        <th className="py-2.5 px-2 font-medium">Beta (β)</th>
                        <th className="py-2.5 px-2 font-medium">Jensen α</th>
                        <th className="py-2.5 px-2 font-medium">R²</th>
                        <th className="py-2.5 px-2 font-medium">Track Error</th>
                        <th className="py-2.5 px-2 font-medium">Info Ratio</th>
                        <th className="py-2.5 px-2 font-medium">Max DD</th>
                        <th className="py-2.5 px-2 font-medium">Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {riskMetricsList.map((m) => (
                        <tr key={m.schemeCode} className="hover:bg-slate-800/40">
                          <td className="py-3 text-left font-sans text-slate-200 font-medium truncate max-w-[180px]">
                            {m.fundName}
                          </td>
                          <td className="py-3 px-2 text-emerald-400 font-bold">{m.cagr.toFixed(2)}%</td>
                          <td className="py-3 px-2 text-slate-300">{m.volatility.toFixed(2)}%</td>
                          <td className="py-3 px-2 font-bold text-sky-400">{m.sharpe.toFixed(2)}</td>
                          <td className="py-3 px-2 font-bold text-emerald-400">{m.sortino.toFixed(2)}</td>
                          <td className="py-3 px-2 text-slate-300">{m.beta.toFixed(2)}</td>
                          <td className={`py-3 px-2 font-bold ${m.jensensAlpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {m.jensensAlpha > 0 ? `+${m.jensensAlpha.toFixed(2)}%` : `${m.jensensAlpha.toFixed(2)}%`}
                          </td>
                          <td className="py-3 px-2 text-slate-300">{m.rSquared.toFixed(3)}</td>
                          <td className="py-3 px-2 text-slate-300">{m.trackingError.toFixed(2)}%</td>
                          <td className="py-3 px-2 font-bold text-amber-400">{m.informationRatio.toFixed(2)}</td>
                          <td className="py-3 px-2 text-rose-400 font-semibold">{m.maxDrawdown.toFixed(2)}%</td>
                          <td className="py-3 px-2 text-slate-400">{m.recoveryDays} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scatter Plot & Drawdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bubble Scatter Plot */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Beta vs. Jensen&apos;s Alpha Scatter
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Bubble radius proportional to Information Ratio. Benchmark anchored at (1.0, 0%).
                  </p>
                  <BubbleScatterPlot metrics={riskMetricsList} />
                </div>

                {/* Drawdown Summary Cards */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Maximum Historical Drawdowns</h3>
                    <p className="text-xs text-slate-400">Peak-to-trough capital decline and recovery timeframe.</p>
                  </div>

                  <div className="space-y-3">
                    {riskMetricsList.map((m) => (
                      <div
                        key={m.schemeCode}
                        className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{m.fundName}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Trough: {m.maxDdDate} · Peak: {m.peakDate}
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-sm font-bold text-rose-400">{m.maxDrawdown.toFixed(2)}%</div>
                          <div className="text-[10px] text-slate-400">Recovery: {m.recoveryDays}d ({m.recoveryDate})</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PORTFOLIO OVERLAP & SECTOR ENGINE                  */}
          {/* ========================================================= */}
          {activeTab === 'overlap' && (
            <div className="space-y-6">
              {/* Pairwise ISIN Overlap Heatmap */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-white">Pairwise ISIN-Level Portfolio Overlap Matrix</h2>
                  <p className="text-xs text-slate-400">
                    Overlap % = ∑ min(Weight_Fund_A, Weight_Fund_B) across all common ISIN security identifiers. Cash excluded.
                  </p>
                </div>

                <OverlapHeatmap names={overlapData.names} matrix={overlapData.matrix} />
              </div>

              {/* Look-through Allocations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Market Cap Exposure */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Look-Through Market-Cap Breakdown
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Aggregate underlying capitalization across portfolio.</p>

                  <div className="space-y-3">
                    {overlapData.mcapExposure.map((item) => (
                      <div key={item.segment} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">{item.segment}</span>
                          <span className="font-mono font-bold text-slate-200">{item.weight.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.weight}%`,
                              backgroundColor:
                                item.segment === 'Large Cap'
                                  ? '#38bdf8'
                                  : item.segment === 'Mid Cap'
                                  ? '#10b981'
                                  : item.segment === 'Small Cap'
                                  ? '#f59e0b'
                                  : '#8b5cf6',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sector Concentrations */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-white mb-1">Top Sector Concentrations</h3>
                  <p className="text-xs text-slate-400 mb-4">Look-through industry sector exposures.</p>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {overlapData.sectorExposure.slice(0, 7).map((item) => (
                      <div key={item.sector} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium truncate max-w-[200px]">
                          {item.sector}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, item.weight * 2.5)}%` }}
                            />
                          </div>
                          <span className="font-mono font-semibold text-slate-200 w-12 text-right">
                            {item.weight.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shared Holdings Inspector */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Pairwise Common Holdings Inspector</h3>
                    <p className="text-xs text-slate-400">
                      Drill down into underlying stock overlap contributions between two specific funds.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={overlapPair[0]}
                      onChange={(e) => setOverlapPair([parseInt(e.target.value, 10), overlapPair[1]])}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      {selectedCodes.map((c) => (
                        <option key={c} value={c}>
                          {allFunds[c]?.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-500 text-xs">vs</span>
                    <select
                      value={overlapPair[1]}
                      onChange={(e) => setOverlapPair([overlapPair[0], parseInt(e.target.value, 10)])}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      {selectedCodes.map((c) => (
                        <option key={c} value={c}>
                          {allFunds[c]?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {sharedHoldings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-sans text-left">
                          <th className="py-2">ISIN</th>
                          <th className="py-2">Holding Name</th>
                          <th className="py-2">Sector</th>
                          <th className="py-2">Market Cap</th>
                          <th className="py-2 text-right">Weight (Fund A)</th>
                          <th className="py-2 text-right">Weight (Fund B)</th>
                          <th className="py-2 text-right text-emerald-400">Overlap Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {sharedHoldings.map((stock) => (
                          <tr key={stock.isin} className="hover:bg-slate-800/40">
                            <td className="py-2 text-slate-400">{stock.isin}</td>
                            <td className="py-2 font-sans text-slate-200 font-medium">{stock.name}</td>
                            <td className="py-2 text-slate-400">{stock.sector}</td>
                            <td className="py-2 text-slate-400">{stock.mcap}</td>
                            <td className="py-2 text-right text-slate-300">{stock.w1.toFixed(2)}%</td>
                            <td className="py-2 text-right text-slate-300">{stock.w2.toFixed(2)}%</td>
                            <td className="py-2 text-right text-emerald-400 font-bold">
                              {stock.overlapContrib.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No overlapping individual equity holdings found between selected funds.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: DEBT & LIQUIDITY STRESS TESTING                   */}
          {/* ========================================================= */}
          {activeTab === 'stress' && (
            <div className="space-y-6">
              {/* Liquidity Stress Section */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Portfolio Liquidity Stress Testing</h2>
                    <p className="text-xs text-slate-400">
                      Mandated SEBI stress horizon: Days required to liquidate 25% and 50% under {adtvParticipation}% 30-day ADTV participation limit.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Analyzed Fund:</span>
                    <select
                      value={stressFundCode}
                      onChange={(e) => setStressFundCode(parseInt(e.target.value, 10))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-sans"
                    >
                      {selectedCodes.map((c) => (
                        <option key={c} value={c}>
                          {allFunds[c]?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Fund AUM</div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      ₹{targetStressFund.aum_cr.toLocaleString()} Cr
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{targetStressFund.category}</div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Days to Liquidate 25%</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {liquidityResult.days25Waterfall} Days
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Pro-Rata: {liquidityResult.days25Prorata} Days
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Days to Liquidate 50%</div>
                    <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {liquidityResult.days50Waterfall} Days
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Pro-Rata: {liquidityResult.days50Prorata} Days
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Illiquid Basket (&gt;10d)</div>
                    <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                      {liquidityResult.pctIlliquidOver10Days.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Under 3 Days: {liquidityResult.pctLiquidUnder3Days.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Stock Level Liquidity Table */}
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-sans text-left">
                        <th className="py-2">ISIN</th>
                        <th className="py-2">Company / Asset</th>
                        <th className="py-2 text-right">Weight</th>
                        <th className="py-2 text-right">Position (₹ Cr)</th>
                        <th className="py-2 text-right">30D ADTV (₹ Cr)</th>
                        <th className="py-2 text-right">Days to 100% Exit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {liquidityResult.holdings.slice(0, 8).map((h) => (
                        <tr key={h.isin} className="hover:bg-slate-800/40">
                          <td className="py-2 text-slate-400">{h.isin}</td>
                          <td className="py-2 font-sans text-slate-200 font-medium">{h.name}</td>
                          <td className="py-2 text-right text-slate-300">{h.weight.toFixed(2)}%</td>
                          <td className="py-2 text-right text-slate-300 font-semibold">₹{h.positionCr.toFixed(1)}</td>
                          <td className="py-2 text-right text-slate-400">₹{h.adtvCr.toFixed(0)}</td>
                          <td className="py-2 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                h.daysToLiquidate > 10
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-900/60'
                                  : h.daysToLiquidate > 3
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-900/50'
                                  : 'bg-emerald-950/50 text-emerald-300 border border-emerald-900/40'
                              }`}
                            >
                              {h.daysToLiquidate.toFixed(1)} d
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Debt Duration & Yield Curve Sensitivity */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Debt Duration &amp; Yield Curve Shock Engine
                    </h3>
                    <p className="text-xs text-slate-400">
                      Macaulay &amp; Modified Duration simulation with second-order Convexity adjustments.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Standard Shock Table */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-300">
                      Standard Rate Shock Scenarios (Base NAV = ₹100.00)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono text-right">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-sans">
                            <th className="py-2 text-left">Yield Shift</th>
                            <th className="py-2 px-2">Duration Effect</th>
                            <th className="py-2 px-2">Convexity Benefit</th>
                            <th className="py-2 px-2">Total NAV Change</th>
                            <th className="py-2 px-2">Simulated NAV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {durationShocks.map((s) => (
                            <tr key={s.shockBps} className="hover:bg-slate-800/40">
                              <td className="py-2 text-left font-sans text-slate-300 font-medium">
                                {s.shockBps > 0 ? `+${s.shockBps} bps` : `${s.shockBps} bps`}
                              </td>
                              <td className="py-2 px-2 text-slate-400">{s.durationImpactPct.toFixed(2)}%</td>
                              <td className="py-2 px-2 text-slate-400">+{s.convexityBenefitPct.toFixed(3)}%</td>
                              <td
                                className={`py-2 px-2 font-bold ${
                                  s.totalNavChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {s.totalNavChangePct > 0 ? `+${s.totalNavChangePct.toFixed(2)}%` : `${s.totalNavChangePct.toFixed(2)}%`}
                              </td>
                              <td className="py-2 px-2 font-bold text-white">₹{s.simulatedNav.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Interactive Slider Simulator */}
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-200">Interactive Yield Curve Shock</span>
                        <span className="font-mono text-indigo-400 font-bold text-sm">
                          {customRateShockBps > 0 ? `+${customRateShockBps}` : customRateShockBps} bps
                        </span>
                      </div>

                      <input
                        type="range"
                        min="-250"
                        max="250"
                        step="25"
                        value={customRateShockBps}
                        onChange={(e) => setCustomRateShockBps(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500 cursor-pointer mb-4"
                      />

                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-1">
                        <div className="text-xs text-slate-400 uppercase font-medium">Simulated Portfolio NAV Impact</div>
                        <div
                          className={`text-2xl font-bold font-mono ${
                            customShockResult.totalImpactPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {customShockResult.totalImpactPct > 0
                            ? `+${customShockResult.totalImpactPct.toFixed(2)}%`
                            : `${customShockResult.totalImpactPct.toFixed(2)}%`}
                        </div>
                        <div className="text-xs font-mono text-slate-300 font-medium">
                          New NAV: ₹{customShockResult.simulatedNav.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Modified Duration (D_mod):</span>
                        <span className="font-mono text-slate-200">{customShockResult.modDur.toFixed(2)} yrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1st-Order Duration Effect:</span>
                        <span className="font-mono text-slate-200">{customShockResult.durImpactPct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2nd-Order Convexity Adjustment:</span>
                        <span className="font-mono text-slate-200">+{customShockResult.cvxBenefitPct.toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: PYTHON STREAMLIT SUITE                            */}
          {/* ========================================================= */}
          {activeTab === 'python' && (
            <div className="space-y-6">
              <PythonExporter />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
