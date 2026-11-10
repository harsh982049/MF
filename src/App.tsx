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
  Search,
  Download,
  Filter,
  X,
  Plus,
  RefreshCw,
  Coins,
  FileText,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { FundMeta, NavPoint, RiskMetrics, AssetClass } from './types/quant';
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
  simulateMonthlySip,
  computeReturnCorrelationMatrix,
} from './utils/quantEngine';
import {
  PerformanceChart,
  RollingBoxPlot,
  BubbleScatterPlot,
  OverlapHeatmap,
  CaptureRatioQuadrant,
  CorrelationHeatmap,
  SipGrowthChart,
} from './components/QuantVisuals';
import { FundSearchModal } from './components/FundSearchModal';
import { FundFactsheetModal } from './components/FundFactsheetModal';
import { DataExportModal } from './components/DataExportModal';
import { PythonExporter } from './components/PythonExporter';
import { classifyAndBuildFundMeta } from './utils/mfapiClassifier';

const COLOR_PALETTE = [
  '#38bdf8', // Sky
  '#34d399', // Emerald
  '#f472b6', // Rose
  '#a78bfa', // Purple
  '#fb923c', // Orange
  '#e879f9', // Fuchsia
  '#2dd4bf', // Teal
];

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'perf' | 'risk' | 'overlap' | 'stress' | 'sip' | 'factsheet' | 'python'>('perf');

  // Active Fund Universe
  const [selectedCodes, setSelectedCodes] = useState<number[]>([122639, 127042, 118989, 118778]);
  const [customFunds, setCustomFunds] = useState<Record<number, FundMeta>>({});
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('^CRSLDX');
  const [timeHorizon, setTimeHorizon] = useState<number>(5);
  const [rfRate, setRfRate] = useState<number>(6.5);
  const [adtvParticipation, setAdtvParticipation] = useState<number>(10);
  const [rollingWindowYears, setRollingWindowYears] = useState<number>(3);

  // Modals
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [factsheetFund, setFactsheetFund] = useState<FundMeta | null>(null);

  // SIP Simulator State
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState<number>(10000);
  const [sipTargetCode, setSipTargetCode] = useState<number>(122639);

  // Debt & Stress State
  const [stressFundCode, setStressFundCode] = useState<number>(120503);
  const [customRateShockBps, setCustomRateShockBps] = useState<number>(50);

  // Time-Series Storage & Loading
  const [fundSeriesMap, setFundSeriesMap] = useState<Record<number, NavPoint[]>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // All combined available funds
  const allFunds = useMemo(() => {
    return { ...PRESET_FUNDS, ...customFunds };
  }, [customFunds]);

  // Active selected fund objects
  const activeFundsList: FundMeta[] = useMemo(() => {
    return selectedCodes.map((code) => allFunds[code] || PRESET_FUNDS[122639]);
  }, [selectedCodes, allFunds]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch or regenerate time-series for all selected funds
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
    return generateBenchmarkSeries(benchmarkSymbol, 12);
  }, [benchmarkSymbol]);

  const activeBenchmark = useMemo(() => {
    return BENCHMARKS.find((b) => b.symbol === benchmarkSymbol) || BENCHMARKS[0];
  }, [benchmarkSymbol]);

  // Add / Remove Fund Handler
  const handleToggleFund = (code: number) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length > 1) {
        setSelectedCodes(selectedCodes.filter((c) => c !== code));
      }
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleAddCustomScheme = async (code: number) => {
    if (!allFunds[code]) {
      try {
        const resp = await fetch(`https://api.mfapi.in/mf/${code}`);
        if (resp.ok) {
          const json = await resp.json();
          const meta = json.meta || { scheme_code: code, scheme_name: `Scheme ${code}` };
          const latestNav = json.data && json.data[0] ? parseFloat(json.data[0].nav) : undefined;
          const newFund = classifyAndBuildFundMeta(meta, latestNav);
          setCustomFunds((prev) => ({ ...prev, [code]: newFund }));

          // Instantly cache series if returned in response
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            const formatted: NavPoint[] = json.data
              .map((item: { date: string; nav: string }) => {
                const parts = item.date.split('-');
                if (parts.length === 3) {
                  return { date: `${parts[2]}-${parts[1]}-${parts[0]}`, nav: parseFloat(item.nav) };
                }
                return null;
              })
              .filter((p: NavPoint | null): p is NavPoint => p !== null && !isNaN(p.nav))
              .sort((a: NavPoint, b: NavPoint) => a.date.localeCompare(b.date));

            if (formatted.length > 0) {
              setFundSeriesMap((prev) => ({ ...prev, [code]: formatted }));
            }
          }
        }
      } catch (err) {
        console.warn(`Fallback for scheme ${code}:`, err);
        const fallbackFund = classifyAndBuildFundMeta({
          scheme_code: code,
          scheme_name: `Mutual Fund Scheme ${code}`,
          fund_house: 'Indian Mutual Fund AMC',
          scheme_category: 'Flexi Cap Fund',
        });
        setCustomFunds((prev) => ({ ...prev, [code]: fallbackFund }));
      }
    }

    if (!selectedCodes.includes(code)) {
      setSelectedCodes((prev) => [...prev, code]);
    }
  };

  // Trailing Returns (3M, 6M, 1Y, 3Y, 5Y, 7Y, 10Y)
  const trailingCagrMap = useMemo(() => {
    const map: Record<number, Record<string, number | undefined>> = {};
    selectedCodes.forEach((code) => {
      const s = fundSeriesMap[code] || [];
      map[code] = computeTrailingCagr(s, [0.25, 0.5, 1, 3, 5, 7, 10]);
    });
    return map;
  }, [selectedCodes, fundSeriesMap]);

  const benchmarkCagr = useMemo(() => {
    return computeTrailingCagr(benchmarkSeries, [0.25, 0.5, 1, 3, 5, 7, 10]);
  }, [benchmarkSeries]);

  // Rolling Return Distributions & Hit Rates
  const rollingAnalysis = useMemo(() => {
    const benchDist = computeRollingReturns(benchmarkSeries, rollingWindowYears);

    const fundsRolling = selectedCodes.map((code, idx) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      const dist = computeRollingReturns(series, rollingWindowYears);
      const hitRate = computeBenchmarkHitRate(dist.series, benchDist.series);
      return {
        code,
        name: fund?.name || `Scheme ${code}`,
        category: fund?.category || 'Equity',
        dist,
        hitRate,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      };
    });

    return {
      benchDist,
      fundsRolling,
    };
  }, [selectedCodes, allFunds, fundSeriesMap, benchmarkSeries, rollingWindowYears]);

  // Risk & Capital Market Line Metrics
  const riskMetricsList: RiskMetrics[] = useMemo(() => {
    return selectedCodes.map((code) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      return computeComprehensiveMetrics(
        series,
        benchmarkSeries,
        fund?.name || `Scheme ${code}`,
        code,
        fund?.category || 'Equity',
        fund?.asset_class || 'Equity',
        rfRate / 100.0
      );
    });
  }, [selectedCodes, allFunds, fundSeriesMap, benchmarkSeries, rfRate]);

  // Overlap & Return Correlation Data
  const overlapData = useMemo(() => {
    const fundsList = selectedCodes.map((code) => ({
      scheme_code: code,
      name: allFunds[code]?.name || `Scheme ${code}`,
      holdings: allFunds[code]?.holdings || [],
    }));

    const matrixRes = computeOverlapMatrix(fundsList);
    const mcapExposure = aggregateMarketCapExposure(fundsList);
    const sectorExposure = aggregateSectorExposure(fundsList);

    const nameMap: Record<number, string> = {};
    selectedCodes.forEach((c) => {
      nameMap[c] = allFunds[c]?.name || `Scheme ${c}`;
    });

    const corrRes = computeReturnCorrelationMatrix(fundSeriesMap, nameMap);

    return {
      names: matrixRes.names,
      matrix: matrixRes.matrix,
      mcapExposure,
      sectorExposure,
      corrNames: corrRes.names,
      corrMatrix: corrRes.matrix,
      diversificationScore: corrRes.diversificationScore,
    };
  }, [selectedCodes, allFunds, fundSeriesMap]);

  // SIP Simulation Result
  const sipResult = useMemo(() => {
    const series = fundSeriesMap[sipTargetCode] || benchmarkSeries;
    return simulateMonthlySip(series, sipMonthlyAmount, timeHorizon);
  }, [fundSeriesMap, sipTargetCode, benchmarkSeries, sipMonthlyAmount, timeHorizon]);

  // Stress Testing Target Fund
  const targetStressFund = useMemo(() => {
    return allFunds[stressFundCode] || activeFundsList[0] || PRESET_FUNDS[120503];
  }, [stressFundCode, allFunds, activeFundsList]);

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

  // Named and sliced series for cumulative performance chart according to timeHorizon
  const slicedPerfData = useMemo(() => {
    const targetDays = timeHorizon * 365.25;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - targetDays * 86400000).toISOString().split('T')[0];

    const slicedBench = benchmarkSeries.filter((p) => p.date >= cutoffDate);
    const slicedMap: Record<string, NavPoint[]> = {};

    selectedCodes.forEach((code) => {
      const name = allFunds[code]?.name || `Scheme ${code}`;
      const series = fundSeriesMap[code] || [];
      const filtered = series.filter((p) => p.date >= cutoffDate);
      slicedMap[name] = filtered.length > 0 ? filtered : series;
    });

    return {
      bench: slicedBench.length > 0 ? slicedBench : benchmarkSeries,
      funds: slicedMap,
    };
  }, [selectedCodes, allFunds, fundSeriesMap, benchmarkSeries, timeHorizon]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-900 selection:text-white">
      {/* Top Bar Contract (3 Zones, Perfectly Aligned) */}
      <header className="border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto w-full px-6 py-3.5 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
              ₹
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                Indian MF Quant Studio
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
                · Institutional Terminal
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => setActiveTab('perf')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'perf' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              Performance &amp; Rolling
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'risk' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              Risk &amp; Alpha
            </button>
            <button
              onClick={() => setActiveTab('overlap')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'overlap' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              ISIN Overlap &amp; Correlation
            </button>
            <button
              onClick={() => setActiveTab('stress')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'stress' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              Debt &amp; Stress
            </button>
            <button
              onClick={() => setActiveTab('sip')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'sip' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              SIP Wealth Simulator
            </button>
            <button
              onClick={() => setActiveTab('factsheet')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'factsheet' ? 'text-emerald-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              Fund Factsheets
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`transition-colors whitespace-nowrap ${
                activeTab === 'python' ? 'text-indigo-400 font-bold underline underline-offset-4' : 'hover:text-white'
              }`}
            >
              Python Suite
            </button>
          </nav>

          {/* Zone 3: Quick Action Bar */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700/80 transition-all shadow-xs"
              title="Search Mutual Funds (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Search Funds</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Active Comparison Strip (Chips with Remove Button) */}
      <section className="border-b border-slate-800/80 bg-[#0c1220] py-2 px-6">
        <div className="max-w-[1720px] mx-auto w-full flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-indigo-400" />
              Comparing ({selectedCodes.length}):
            </span>

            {activeFundsList.map((fund) => (
              <div
                key={fund.scheme_code}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs shadow-xs"
              >
                <span className="truncate max-w-[150px] font-medium" title={fund.name}>
                  {fund.name}
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                  fund.asset_class === 'Debt' ? 'bg-amber-950 text-amber-300' :
                  fund.asset_class === 'Hybrid' ? 'bg-purple-950 text-purple-300' :
                  'bg-indigo-950 text-indigo-300'
                }`}>
                  {fund.category}
                </span>
                {selectedCodes.length > 1 && (
                  <button
                    onClick={() => handleToggleFund(fund.scheme_code)}
                    className="p-0.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700 transition-colors"
                    title={`Remove ${fund.name} from comparison`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fund</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>Benchmark: <span className="text-amber-400 font-semibold">{activeBenchmark.name}</span></span>
            <span>·</span>
            <span>Rf: <span className="text-emerald-400 font-semibold">{rfRate.toFixed(2)}%</span></span>
            <span>·</span>
            <span>ADTV Limit: <span className="text-sky-400 font-semibold">{adtvParticipation}%</span></span>
          </div>
        </div>
      </section>

      {/* Main Workspace Canvas (Full Width & Aligned) */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left Side Quick Parameter Drawer */}
        <aside className="w-full lg:w-64 shrink-0 space-y-5 bg-[#0f172a]/70 border border-slate-800 rounded-xl p-4.5 self-start shadow-sm">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Benchmark Index
            </label>
            <select
              value={benchmarkSymbol}
              onChange={(e) => setBenchmarkSymbol(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {BENCHMARKS.map((b) => (
                <option key={b.symbol} value={b.symbol}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="font-bold uppercase tracking-wider">Analysis Horizon</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {timeHorizon === 0.25
                  ? '3 Months'
                  : timeHorizon === 0.5
                  ? '6 Months'
                  : timeHorizon >= 12
                  ? 'Max (12Y)'
                  : `${timeHorizon} Years`}
              </span>
            </div>
            {/* Horizon Select Dropdown */}
            <select
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 mb-2 font-mono"
            >
              <option value={0.25}>3 Months (0.25 Year)</option>
              <option value={0.5}>6 Months (0.50 Year)</option>
              <option value={1}>1 Year (Trailing 1Y)</option>
              <option value={3}>3 Years (Trailing 3Y)</option>
              <option value={5}>5 Years (Trailing 5Y)</option>
              <option value={7}>7 Years (Trailing 7Y)</option>
              <option value={10}>10 Years (Trailing 10Y)</option>
              <option value={12}>Max History (~12 Years)</option>
            </select>
            {/* Quick Horizon Buttons */}
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '3M', val: 0.25 },
                { label: '6M', val: 0.5 },
                { label: '1Y', val: 1 },
                { label: '3Y', val: 3 },
                { label: '5Y', val: 5 },
                { label: '7Y', val: 7 },
                { label: '10Y', val: 10 },
                { label: 'Max', val: 12 },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setTimeHorizon(item.val)}
                  className={`py-1 text-xs rounded-lg font-mono transition-colors ${
                    timeHorizon === item.val
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span className="font-bold uppercase tracking-wider">Risk-Free Rate (Rf)</span>
              <span className="font-mono text-indigo-400 font-semibold">{rfRate.toFixed(2)}%</span>
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
            <div className="text-[10px] text-slate-500 mt-0.5">Indian 10Y Sovereign G-Sec</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span className="font-bold uppercase tracking-wider">ADTV Participation</span>
              <span className="font-mono text-amber-400 font-semibold">{adtvParticipation}%</span>
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
            <div className="text-[10px] text-slate-500 mt-0.5">Daily market volume liquidity limit</div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Browse All Mutual Funds</span>
            </button>
          </div>
        </aside>

        {/* Central Dynamic Viewport */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* ========================================================= */}
          {/* TAB 1: PERFORMANCE & ROLLING RETURNS                     */}
          {/* ========================================================= */}
          {activeTab === 'perf' && (
            <div className="space-y-6">
              {/* Cumulative Growth Chart */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Cumulative Growth (Rebased to 100)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Normalized performance rebased to 100 at start of {timeHorizon}-year horizon against {activeBenchmark.name}.
                    </p>
                  </div>
                  {isRefreshing && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing time-series...</span>
                    </div>
                  )}
                </div>

                <PerformanceChart
                  seriesMap={slicedPerfData.funds}
                  benchSeries={slicedPerfData.bench}
                  benchName={activeBenchmark.name}
                  colors={COLOR_PALETTE}
                />
              </div>

              {/* Trailing Returns Table & Rolling Hit Rates */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Trailing Returns Table */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-white">Trailing Returns &amp; CAGR (%) Matrix</h3>
                    <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
                      Sub-annual &amp; Multi-year
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Absolute returns for &lt;1Y; annualized CAGR for ≥1Y.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-right">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-sans">
                          <th className="py-2.5 text-left font-medium">Scheme / Benchmark</th>
                          <th className="py-2.5 px-2 font-medium" title="3-Month Absolute Return">3M*</th>
                          <th className="py-2.5 px-2 font-medium" title="6-Month Absolute Return">6M*</th>
                          <th className="py-2.5 px-2 font-medium">1Y</th>
                          <th className="py-2.5 px-2 font-medium">3Y</th>
                          <th className="py-2.5 px-2 font-medium">5Y</th>
                          <th className="py-2.5 px-2 font-medium">7Y</th>
                          <th className="py-2.5 px-2 font-medium">10Y</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeFundsList.map((fund) => {
                          const cagr = trailingCagrMap[fund.scheme_code] || {};
                          const renderCell = (val: number | undefined) => {
                            if (val === undefined) return <span className="text-slate-500 font-normal">N/A</span>;
                            return (
                              <span className={val >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}%
                              </span>
                            );
                          };
                          return (
                            <tr key={fund.scheme_code} className="hover:bg-slate-800/40">
                              <td className="py-2.5 text-left font-sans text-slate-200 font-medium truncate max-w-[180px]">
                                {fund.name}
                              </td>
                              <td className="py-2.5 px-2">{renderCell(cagr['3M'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['6M'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['1Y'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['3Y'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['5Y'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['7Y'])}</td>
                              <td className="py-2.5 px-2">{renderCell(cagr['10Y'])}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-amber-950/20 font-semibold border-t-2 border-slate-700">
                          <td className="py-2.5 text-left font-sans text-amber-300">
                            {activeBenchmark.name} (Bench)
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['3M'] !== undefined ? `${benchmarkCagr['3M'] > 0 ? '+' : ''}${benchmarkCagr['3M'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['6M'] !== undefined ? `${benchmarkCagr['6M'] > 0 ? '+' : ''}${benchmarkCagr['6M'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['1Y'] !== undefined ? `${benchmarkCagr['1Y'] > 0 ? '+' : ''}${benchmarkCagr['1Y'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['3Y'] !== undefined ? `${benchmarkCagr['3Y'] > 0 ? '+' : ''}${benchmarkCagr['3Y'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['5Y'] !== undefined ? `${benchmarkCagr['5Y'] > 0 ? '+' : ''}${benchmarkCagr['5Y'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['7Y'] !== undefined ? `${benchmarkCagr['7Y'] > 0 ? '+' : ''}${benchmarkCagr['7Y'].toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2 text-amber-300 font-bold">
                            {benchmarkCagr['10Y'] !== undefined ? `${benchmarkCagr['10Y'] > 0 ? '+' : ''}${benchmarkCagr['10Y'].toFixed(2)}%` : 'N/A'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    *3M &amp; 6M are absolute cumulative returns; ≥1Y periods are annualized compound rates (CAGR). N/A denotes fund age is shorter than period.
                  </div>
                </div>

                {/* Benchmark Outperformance Hit Rate */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-white">
                        {rollingWindowYears}Y Rolling Benchmark Hit Rate (%)
                      </h3>
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg text-xs font-mono">
                        {[1, 3, 5, 7].map((yr) => (
                          <button
                            key={yr}
                            onClick={() => setRollingWindowYears(yr)}
                            className={`px-2 py-0.5 rounded transition-colors ${
                              rollingWindowYears === yr
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {yr}Y
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Percentage of continuous {rollingWindowYears}-year rolling windows beating {activeBenchmark.name}.
                    </p>

                    <div className="space-y-3.5">
                      {rollingAnalysis.fundsRolling.map((fund) => {
                        const hit = fund.hitRate;
                        const isAvailable = hit !== undefined && fund.dist.count > 0;
                        return (
                          <div key={fund.code} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-medium truncate max-w-[240px]">
                                {fund.name}
                              </span>
                              <span className="font-mono font-bold text-emerald-400">
                                {isAvailable ? `${hit.toFixed(1)}%` : <span className="text-slate-500 font-normal">N/A (insufficient data)</span>}
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                              {isAvailable ? (
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, hit))}%`,
                                    backgroundColor: hit > 70 ? '#10b981' : hit > 50 ? '#38bdf8' : '#fb923c',
                                  }}
                                />
                              ) : (
                                <div className="h-full bg-slate-700/40 w-full" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                    Evaluated over {rollingAnalysis.benchDist.count} continuous rolling trading windows.
                  </div>
                </div>
              </div>

              {/* Complete Rolling Return Distributions Summary Table */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {rollingWindowYears}-Year Rolling Return Distribution &amp; Statistical Spread
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mean (Average), Median, Minimum, Maximum, 25th / 75th Percentile IQR, and Positive Windows probability.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto my-3">
                  <table className="w-full text-xs font-mono text-right">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-sans">
                        <th className="py-2 text-left font-medium">Scheme</th>
                        <th className="py-2 px-2 font-medium">Mean (Avg)</th>
                        <th className="py-2 px-2 font-medium">Median</th>
                        <th className="py-2 px-2 font-medium">Min (Worst)</th>
                        <th className="py-2 px-2 font-medium">Max (Best)</th>
                        <th className="py-2 px-2 font-medium">25th %ile</th>
                        <th className="py-2 px-2 font-medium">75th %ile</th>
                        <th className="py-2 px-2 font-medium">Std Dev</th>
                        <th className="py-2 px-2 font-medium text-emerald-400">% Positive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {rollingAnalysis.fundsRolling.map((f) => (
                        <tr key={f.code} className="hover:bg-slate-800/40">
                          <td className="py-2.5 text-left font-sans text-slate-200 font-medium truncate max-w-[180px]">
                            {f.name}
                          </td>
                          {f.dist.count > 0 ? (
                            <>
                              <td className="py-2.5 px-2 text-emerald-400 font-bold">{f.dist.mean.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-white font-bold">{f.dist.median.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-rose-400">{f.dist.min.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-sky-400 font-bold">{f.dist.max.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-slate-300">{f.dist.q25.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-slate-300">{f.dist.q75.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-slate-400">{f.dist.std.toFixed(2)}%</td>
                              <td className="py-2.5 px-2 text-emerald-400 font-bold">{f.dist.pctPositive.toFixed(1)}%</td>
                            </>
                          ) : (
                            <td colSpan={8} className="py-2.5 px-2 text-center text-slate-500 font-sans italic">
                              N/A (Fund history is shorter than {rollingWindowYears} years)
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-amber-950/20 font-semibold border-t border-slate-700">
                        <td className="py-2.5 text-left font-sans text-amber-300">
                          {activeBenchmark.name} (Bench)
                        </td>
                        <td className="py-2.5 px-2 text-amber-300">{rollingAnalysis.benchDist.mean.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-amber-300">{rollingAnalysis.benchDist.median.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-rose-400">{rollingAnalysis.benchDist.min.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-amber-300">{rollingAnalysis.benchDist.max.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-amber-300">{rollingAnalysis.benchDist.q25.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-amber-300">{rollingAnalysis.benchDist.q75.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-slate-400">{rollingAnalysis.benchDist.std.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-emerald-400 font-bold">{rollingAnalysis.benchDist.pctPositive.toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Box Plot Visualizer */}
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
          {/* TAB 2: RISK & ALPHA ENGINE                                */}
          {/* ========================================================= */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              {/* Comprehensive Risk Matrix */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Risk-Adjusted Ratios &amp; Active Alpha</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                        <th className="py-2.5 px-2 font-medium">Track Err</th>
                        <th className="py-2.5 px-2 font-medium">Info Ratio</th>
                        <th className="py-2.5 px-2 font-medium">Max DD</th>
                        <th className="py-2.5 px-2 font-medium">Calmar</th>
                        <th className="py-2.5 px-2 font-medium">Up / Down Cap</th>
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
                          <td className="py-3 px-2 text-emerald-400 font-bold">{m.calmarRatio.toFixed(2)}</td>
                          <td className="py-3 px-2 text-slate-300">
                            <span className="text-emerald-400">{m.upsideCapture}%</span> / <span className="text-amber-400">{m.downsideCapture}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Capture Ratio & Beta/Alpha Quadrants */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Upside vs. Downside Capture Ratio Quadrant
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Assesses asymmetry: Ability to outrun the benchmark in bull runs while falling less in bear phases.
                  </p>
                  <CaptureRatioQuadrant metrics={riskMetricsList} />
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Beta vs. Jensen&apos;s Alpha Scatter
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Bubble radius proportional to Information Ratio. Benchmark anchored at (1.0, 0%).
                  </p>
                  <BubbleScatterPlot metrics={riskMetricsList} />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ISIN OVERLAP & RETURN CORRELATION                  */}
          {/* ========================================================= */}
          {activeTab === 'overlap' && (
            <div className="space-y-6">
              {/* Pairwise ISIN Overlap Heatmap */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-base font-bold text-white tracking-tight">Pairwise ISIN-Level Holding Overlap Matrix</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Overlap % = ∑ min(Weight_Fund_A, Weight_Fund_B) across all shared securities. Identifies hidden stock concentration.
                  </p>
                </div>

                <OverlapHeatmap names={overlapData.names} matrix={overlapData.matrix} />
              </div>

              {/* Daily Return Correlation Matrix */}
              <CorrelationHeatmap
                names={overlapData.corrNames}
                matrix={overlapData.corrMatrix}
                diversificationScore={overlapData.diversificationScore}
              />

              {/* Look-through Allocations */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Market Cap Exposure */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">
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
                  <h3 className="text-sm font-bold text-white mb-1">Top Sector Concentrations</h3>
                  <p className="text-xs text-slate-400 mb-4">Look-through industry sector exposures.</p>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {overlapData.sectorExposure.slice(0, 8).map((item) => (
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
                    <h2 className="text-base font-bold text-white tracking-tight">Portfolio Liquidity Stress Testing</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      SEBI liquidity stress horizon: Days to liquidate 25% and 50% under {adtvParticipation}% 30-day ADTV participation limit.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Target Scheme:</span>
                    <select
                      value={stressFundCode}
                      onChange={(e) => setStressFundCode(parseInt(e.target.value, 10))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      {activeFundsList.map((f) => (
                        <option key={f.scheme_code} value={f.scheme_code}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                        <th className="py-2">Holding Name</th>
                        <th className="py-2 text-right">Weight</th>
                        <th className="py-2 text-right">Position (₹ Cr)</th>
                        <th className="py-2 text-right">30D ADTV</th>
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
                          <td className="py-2 text-right text-slate-400">₹{h.adtvCr.toFixed(0)} Cr</td>
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
                    <h3 className="text-sm font-bold text-white">
                      Debt Duration &amp; Yield Curve Shock Engine
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Macaulay &amp; Modified Duration simulation with second-order Convexity adjustments.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                        <span className="text-xs font-semibold text-slate-200">Interactive Yield Curve Shift</span>
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
                          Simulated NAV: ₹{customShockResult.simulatedNav.toFixed(2)}
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
          {/* TAB 5: SIP WEALTH SIMULATOR & XIRR ENGINE                 */}
          {/* ========================================================= */}
          {activeTab === 'sip' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Systematic Investment Plan (SIP) Simulator</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Backtest rupee-cost averaging across historical daily NAV cycles and compute exact annualized XIRR.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Target Scheme:</span>
                    <select
                      value={sipTargetCode}
                      onChange={(e) => setSipTargetCode(parseInt(e.target.value, 10))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      {activeFundsList.map((f) => (
                        <option key={f.scheme_code} value={f.scheme_code}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Monthly Investment</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">₹{sipMonthlyAmount.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={sipMonthlyAmount}
                      onChange={(e) => setSipMonthlyAmount(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="text-[10px] text-slate-500">Adjust monthly SIP contribution</div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Accumulated Corpus</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      ₹{sipResult.totalCorpus.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Invested: ₹{sipResult.totalInvested.toLocaleString()} · Net Gain: +₹{sipResult.absoluteProfit.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Annualized XIRR</div>
                    <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                      {sipResult.xirrPct}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Internal Rate of Return over {timeHorizon} years
                    </div>
                  </div>
                </div>

                <SipGrowthChart
                  simulation={sipResult}
                  fundName={allFunds[sipTargetCode]?.name || 'Target Fund'}
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: FUND FACTSHEETS & QUALITATIVE DOSSIER              */}
          {/* ========================================================= */}
          {activeTab === 'factsheet' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Fund Factsheets &amp; Manager Dossiers</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Official qualitative profiles, portfolio turnover, SEBI riskometer ratings, and lead manager tenures.
                  </p>
                </div>

                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Browse More Factsheets</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {activeFundsList.map((fund) => (
                  <div
                    key={fund.scheme_code}
                    className="p-5 bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl space-y-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{fund.name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                            {fund.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          {fund.fund_house} · ISIN: {fund.isin}
                        </div>
                      </div>

                      <button
                        onClick={() => setFactsheetFund(fund)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                      >
                        Deep Dive
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-950/80 rounded-lg">
                        <div className="text-slate-400 text-[10px]">AUM</div>
                        <div className="font-mono font-bold text-white mt-0.5">₹{fund.aum_cr.toLocaleString()} Cr</div>
                      </div>
                      <div className="p-2.5 bg-slate-950/80 rounded-lg">
                        <div className="text-slate-400 text-[10px]">TER (Direct)</div>
                        <div className="font-mono font-bold text-emerald-400 mt-0.5">{fund.expense_ratio_direct}%</div>
                      </div>
                      <div className="p-2.5 bg-slate-950/80 rounded-lg">
                        <div className="text-slate-400 text-[10px]">Turnover</div>
                        <div className="font-mono font-bold text-amber-400 mt-0.5">{fund.turnover_ratio_pct}%</div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-lg space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{fund.manager.name}</span>
                        <span className="font-mono text-emerald-400 text-[11px] font-semibold">{fund.manager.tenureYears} yrs on fund</span>
                      </div>
                      <p className="text-slate-400 line-clamp-2 text-[11px] leading-relaxed">
                        {fund.manager.bio}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                      <span>Riskometer: <span className="font-semibold text-rose-400">{fund.riskometer}</span></span>
                      <span>Min SIP: <span className="font-mono font-semibold text-white">₹{fund.min_sip_inr}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: PYTHON STREAMLIT SUITE                            */}
          {/* ========================================================= */}
          {activeTab === 'python' && (
            <div className="space-y-6">
              <PythonExporter />
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <FundSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        availableFunds={allFunds}
        selectedCodes={selectedCodes}
        onToggleFund={handleToggleFund}
        onAddCustomScheme={handleAddCustomScheme}
      />

      <FundFactsheetModal
        fund={factsheetFund}
        isOpen={!!factsheetFund}
        onClose={() => setFactsheetFund(null)}
      />

      <DataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedFunds={activeFundsList}
        riskMetrics={riskMetricsList}
        trailingCagrMap={trailingCagrMap}
        seriesMap={fundSeriesMap}
        benchmarkSeries={benchmarkSeries}
        benchmarkName={activeBenchmark.name}
      />
    </div>
  );
}
