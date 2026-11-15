/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  X,
  Plus,
  RefreshCw,
  Briefcase,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react';

import {
  FundMeta,
  NavPoint,
  NavValidationReport,
  RiskMetrics,
  SchemeIdentityAudit,
  TrailingCagrResult,
  ValidatedNavSeries,
} from './types/quant';
import {
  PRESET_FUNDS,
  BENCHMARKS,
  DEFAULT_VERIFIED_PRESET_CODES,
  resolveBenchmarkSeries,
  fetchLiveMfNav,
} from './data/presetFunds';
import {
  computeTrailingCagrWithMeta,
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
import { AMFI_SNAPSHOT_DATE, PRESET_RECONCILIATION_TABLE } from './utils/schemeIdentity';
import { addSchemeWorkflow, SchemeExpectationInput } from './utils/schemeWorkflow';

const COLOR_PALETTE = [
  '#38bdf8',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#e879f9',
  '#2dd4bf',
];

const formatOptNum = (
  val: number | null | undefined,
  decimals: number = 2,
  suffix: string = '',
  plusSign: boolean = false
): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  const sign = plusSign && val > 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}${suffix}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'perf' | 'risk' | 'overlap' | 'stress' | 'sip' | 'factsheet' | 'python'>('perf');

  // Default to the 4 AMFI-verified / ISIN-reconciled presets; blocked presets are quarantined
  const [selectedCodes, setSelectedCodes] = useState<number[]>(DEFAULT_VERIFIED_PRESET_CODES);
  const [customFunds, setCustomFunds] = useState<Record<number, FundMeta>>({});
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('^CRSLDX');
  const [timeHorizon, setTimeHorizon] = useState<number>(5);
  const [rfRate, setRfRate] = useState<number>(6.5);
  const [adtvParticipation, setAdtvParticipation] = useState<number>(10);
  const [rollingWindowYears, setRollingWindowYears] = useState<number>(3);

  // Modals
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [factsheetFund, setFactsheetFund] = useState<FundMeta | null>(null);

  // SIP & Stress Target State
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState<number>(10000);
  const [sipTargetCode, setSipTargetCode] = useState<number>(DEFAULT_VERIFIED_PRESET_CODES[0]);
  const [stressFundCode, setStressFundCode] = useState<number>(DEFAULT_VERIFIED_PRESET_CODES[0]);
  const [customRateShockBps, setCustomRateShockBps] = useState<number>(50);

  // Validated Time-Series Storage & Loading
  const [validatedSeriesMap, setValidatedSeriesMap] = useState<Record<number, ValidatedNavSeries>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const allFunds = useMemo(() => {
    return { ...PRESET_FUNDS, ...customFunds };
  }, [customFunds]);

  const activeFundsList: FundMeta[] = useMemo(() => {
    return selectedCodes
      .map((code) => allFunds[code])
      .filter((f): f is FundMeta => Boolean(f));
  }, [selectedCodes, allFunds]);

  // Derived valid NAV series, validation report & effective runtime identity maps
  const identityMap = useMemo(() => {
    const map: Record<number, SchemeIdentityAudit | undefined> = {};
    for (const code of selectedCodes) {
      map[code] = validatedSeriesMap[code]?.identity ?? allFunds[code]?.identityStatus;
    }
    return map;
  }, [selectedCodes, validatedSeriesMap, allFunds]);

  const fundSeriesMap = useMemo(() => {
    const map: Record<number, NavPoint[]> = {};
    for (const code of selectedCodes) {
      const entry = validatedSeriesMap[code];
      const effId = entry?.identity ?? allFunds[code]?.identityStatus;
      map[code] = entry && entry.validation.usable && effId?.verified ? entry.points : [];
    }
    return map;
  }, [selectedCodes, validatedSeriesMap, allFunds]);

  const validationMap = useMemo(() => {
    const map: Record<number, NavValidationReport | undefined> = {};
    for (const code of selectedCodes) {
      map[code] = validatedSeriesMap[code]?.validation;
    }
    return map;
  }, [selectedCodes, validatedSeriesMap]);

  // Ensure SIP and Stress selectors track a currently selected scheme
  useEffect(() => {
    if (selectedCodes.length > 0 && !selectedCodes.includes(sipTargetCode)) {
      setSipTargetCode(selectedCodes[0]);
    }
    if (selectedCodes.length > 0 && !selectedCodes.includes(stressFundCode)) {
      setStressFundCode(selectedCodes[0]);
    }
  }, [selectedCodes, sipTargetCode, stressFundCode]);

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

  // Fetch & validate NAV time-series when selectedCodes change (independent of horizon switches)
  useEffect(() => {
    let isMounted = true;
    const missingCodes = selectedCodes.filter((code) => !validatedSeriesMap[code]);
    if (missingCodes.length === 0) return;

    setIsRefreshing(true);
    const loadMissing = async () => {
      const fetched: Record<number, ValidatedNavSeries> = {};
      for (const code of missingCodes) {
        fetched[code] = await fetchLiveMfNav(code, { expectedMeta: allFunds[code] });
      }
      if (isMounted) {
        setValidatedSeriesMap((prev) => ({ ...prev, ...fetched }));
        setIsRefreshing(false);
      }
    };

    loadMissing();
    return () => {
      isMounted = false;
    };
  }, [selectedCodes, allFunds, validatedSeriesMap]);

  // Independent Benchmark Resolution: strictly invariant to fund list, lead fund, or reorder
  const benchmarkStatus = useMemo(() => {
    return resolveBenchmarkSeries(benchmarkSymbol);
  }, [benchmarkSymbol]);

  const benchmarkSeries = benchmarkStatus.series;

  const handleToggleFund = (code: number) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length > 1) {
        setSelectedCodes(selectedCodes.filter((c) => c !== code));
      }
      return;
    }

    const rec = PRESET_RECONCILIATION_TABLE[code];
    if (rec && !rec.selectable) {
      return;
    }
    setSelectedCodes([...selectedCodes, code]);
  };

  const handleAddCustomScheme = async (
    code: number,
    expectation?: Partial<SchemeExpectationInput>
  ): Promise<{ ok: boolean; message?: string }> => {
    const result = await addSchemeWorkflow({
      requestedCode: expectation?.requestedCode ?? code,
      expectedName: expectation?.expectedName,
      expectedPlan: expectation?.expectedPlan,
      expectedOption: expectation?.expectedOption,
      expectedIsin: expectation?.expectedIsin,
      selectedCodes,
      customFunds,
      validatedSeriesMap,
      allFunds,
    });

    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    setCustomFunds(result.nextCustomFunds);
    setValidatedSeriesMap(result.nextValidatedSeriesMap);
    setSelectedCodes(result.nextSelectedCodes);
    return { ok: true, message: result.message };
  };

  // Trailing Returns with unavailable reasons
  const trailingMetaMap = useMemo(() => {
    const map: Record<number, TrailingCagrResult> = {};
    selectedCodes.forEach((code) => {
      const s = fundSeriesMap[code] || [];
      const breaks = validationMap[code]?.corporateActionBreaks;
      map[code] = computeTrailingCagrWithMeta(s, [0.25, 0.5, 1, 3, 5, 7, 10], breaks);
    });
    return map;
  }, [selectedCodes, fundSeriesMap, validationMap]);

  const benchmarkCagrMeta = useMemo(() => {
    return computeTrailingCagrWithMeta(benchmarkSeries, [0.25, 0.5, 1, 3, 5, 7, 10]);
  }, [benchmarkSeries]);

  // Rolling Return Distributions & Hit Rates
  const rollingAnalysis = useMemo(() => {
    const benchDist = computeRollingReturns(benchmarkSeries, rollingWindowYears);

    const fundsRolling = selectedCodes.map((code, idx) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      const breaks = validationMap[code]?.corporateActionBreaks;
      const dist = computeRollingReturns(series, rollingWindowYears, 252, breaks);
      const hitRate =
        benchmarkStatus.available && dist.available && benchDist.available
          ? computeBenchmarkHitRate(dist.series, benchDist.series)
          : null;
      return {
        code,
        name: fund?.name || `Scheme ${code}`,
        category: fund?.category || 'Unclassified',
        dist,
        hitRate,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      };
    });

    return { benchDist, fundsRolling };
  }, [selectedCodes, allFunds, fundSeriesMap, validationMap, benchmarkSeries, benchmarkStatus.available, rollingWindowYears]);

  // Risk & Capital Market Line Metrics (Fund-only vs Benchmark-relative decoupled)
  const riskMetricsList: RiskMetrics[] = useMemo(() => {
    return selectedCodes.map((code) => {
      const fund = allFunds[code];
      const series = fundSeriesMap[code] || [];
      const breaks = validationMap[code]?.corporateActionBreaks;
      return computeComprehensiveMetrics(
        series,
        benchmarkSeries,
        fund?.name || `Scheme ${code}`,
        code,
        fund?.category || 'Unclassified',
        fund?.asset_class || 'Equity',
        rfRate / 100.0,
        breaks
      );
    });
  }, [selectedCodes, allFunds, fundSeriesMap, validationMap, benchmarkSeries, rfRate]);

  // Overlap, Market-Cap, Sector & Return Correlation (coverage-aware)
  const overlapData = useMemo(() => {
    const fundsList = selectedCodes.map((code) => ({
      scheme_code: code,
      name: allFunds[code]?.name || `Scheme ${code}`,
      holdings: allFunds[code]?.holdings ?? null,
      partialCoverage: allFunds[code]?.holdingsStatus.partialCoverage ?? false,
    }));

    const matrixRes = computeOverlapMatrix(fundsList);
    const mcapExposure = aggregateMarketCapExposure(fundsList);
    const sectorExposure = aggregateSectorExposure(fundsList);

    const nameMap: Record<number, string> = {};
    selectedCodes.forEach((c) => {
      nameMap[c] = allFunds[c]?.name || `Scheme ${c}`;
    });

    const activeSeriesOnly: Record<number, NavPoint[]> = {};
    selectedCodes.forEach((c) => {
      activeSeriesOnly[c] = fundSeriesMap[c] || [];
    });

    const corrRes = computeReturnCorrelationMatrix(activeSeriesOnly, nameMap);

    return {
      overlapMatrixResult: matrixRes,
      overlapAvailable: matrixRes.available,
      overlapExactAvailable: matrixRes.exactAvailable,
      overlapReason: matrixRes.reason,
      names: matrixRes.names,
      matrix: matrixRes.matrix,
      observedSubsetMatrix: matrixRes.observedSubsetMatrix,
      coveragePctByFund: matrixRes.coveragePctByFund,
      unknownPctByFund: matrixRes.unknownPctByFund,
      cashPctByFund: matrixRes.cashPctByFund,
      nonCashPctByFund: matrixRes.nonCashPctByFund,
      rawTotalPctByFund: matrixRes.rawTotalPctByFund,
      coverageStatusByFund: matrixRes.coverageStatusByFund,
      coverageDetailByFund: matrixRes.coverageDetailByFund,
      mcapExposure,
      sectorExposure,
      corrAvailable: corrRes.available,
      corrReason: corrRes.reason,
      corrNames: corrRes.names,
      corrMatrix: corrRes.matrix,
      diversificationScore: corrRes.diversificationScore,
    };
  }, [selectedCodes, allFunds, fundSeriesMap]);

  // SIP Simulation Result — NEVER falls back to benchmarkSeries
  const sipResult = useMemo(() => {
    const series = fundSeriesMap[sipTargetCode] || [];
    const breaks = validationMap[sipTargetCode]?.corporateActionBreaks;
    return simulateMonthlySip(series, sipMonthlyAmount, timeHorizon, breaks);
  }, [fundSeriesMap, validationMap, sipTargetCode, sipMonthlyAmount, timeHorizon]);

  // Stress Testing Target Fund
  const targetStressFund = useMemo(() => {
    return allFunds[stressFundCode] || activeFundsList[0] || PRESET_FUNDS[122639];
  }, [stressFundCode, allFunds, activeFundsList]);

  const liquidityResult = useMemo(() => {
    return calculateLiquidityStress(
      targetStressFund.holdings,
      targetStressFund.aum_cr,
      adtvParticipation / 100.0
    );
  }, [targetStressFund, adtvParticipation]);

  const durationResult = useMemo(() => {
    return calculateDurationSensitivity(
      targetStressFund.macaulay_duration,
      targetStressFund.ytm,
      null
    );
  }, [targetStressFund]);

  const customShockResult = useMemo(() => {
    const macDur = targetStressFund.macaulay_duration;
    const ytm = targetStressFund.ytm;
    if (macDur == null || ytm == null || !Number.isFinite(macDur) || macDur <= 0 || !Number.isFinite(ytm)) {
      return { available: false, reason: durationResult.reason };
    }
    const modDur = macDur / (1.0 + ytm);
    const deltaY = customRateShockBps / 10000.0;
    const durImpact = -modDur * deltaY;
    return {
      available: true,
      modDur,
      durImpactPct: durImpact * 100,
      simulatedNav: 100.0 * (1.0 + durImpact),
    };
  }, [targetStressFund, customRateShockBps, durationResult.reason]);

  // Sliced cumulative performance series using latest validated date (not browser clock skew)
  const slicedPerfData = useMemo(() => {
    let latestIso = '';
    selectedCodes.forEach((code) => {
      const s = fundSeriesMap[code];
      if (s && s.length > 0 && s[s.length - 1].date > latestIso) {
        latestIso = s[s.length - 1].date;
      }
    });
    if (benchmarkSeries.length > 0 && benchmarkSeries[benchmarkSeries.length - 1].date > latestIso) {
      latestIso = benchmarkSeries[benchmarkSeries.length - 1].date;
    }

    const anchorDate = latestIso ? new Date(`${latestIso}T00:00:00Z`) : new Date();
    const targetDays = timeHorizon * 365.25;
    const cutoffDate = new Date(anchorDate.getTime() - targetDays * 86400000).toISOString().split('T')[0];

    const slicedBench = benchmarkSeries.filter((p) => p.date >= cutoffDate);
    const slicedMap: Record<string, NavPoint[]> = {};

    selectedCodes.forEach((code) => {
      const name = allFunds[code]?.name || `Scheme ${code}`;
      const series = fundSeriesMap[code] || [];
      const breaks = validationMap[code]?.corporateActionBreaks || [];
      const filtered = series.filter((p) => p.date >= cutoffDate);
      const effective = filtered.length > 0 ? filtered : series;
      // Do not chart split-corrupted curve across an unresolved break
      const hasBreakInSlice =
        effective.length >= 2 &&
        breaks.some((b) => effective[0].date < b.date && effective[effective.length - 1].date >= b.date);
      slicedMap[name] = hasBreakInSlice ? [] : effective;
    });

    return {
      bench: slicedBench.length > 0 ? slicedBench : benchmarkSeries,
      funds: slicedMap,
    };
  }, [selectedCodes, allFunds, fundSeriesMap, validationMap, benchmarkSeries, timeHorizon]);

  // Active warnings across selected schemes (exposes identity mismatches & rejected payload diagnostics cleanly)
  const activeWarnings = useMemo(() => {
    const msgs: string[] = [];
    selectedCodes.forEach((code) => {
      const val = validationMap[code];
      const effId = identityMap[code];
      if (!val) return;
      if (!val.usable) {
        const diag = val.rejectedPayloadDiagnostics;
        const diagDetail =
          diag && diag.returnedSchemeCode !== null && diag.returnedSchemeCode !== code
            ? ` [Rejected payload: returned code ${diag.returnedSchemeCode} (${diag.returnedSchemeName || 'Unknown'}), ${diag.totalRawCount} unattributed obs suppressed]`
            : '';
        msgs.push(
          `Scheme ${code}: ${val.unavailableReason || effId?.reason || 'Validation failed.'}${diagDetail}`
        );
      } else {
        if (val.rejectedPostCutoffCount > 0) {
          msgs.push(
            `Scheme ${code}: Ignored ${val.rejectedPostCutoffCount} post-cutoff NAV observation(s) after ${val.valuationCutoffDate}.`
          );
        }
        if (val.quarantinedFromBreak) {
          val.corporateActionBreaks.forEach((b) => msgs.push(`Scheme ${code}: ${b.explanation}`));
        }
      }
    });
    return msgs;
  }, [selectedCodes, validationMap, identityMap]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-900 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto w-full px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
              ₹
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                Indian MF Quant Studio
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
                · Identity &amp; Output Safety Terminal
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
            {[
              { id: 'perf', label: 'Performance & Rolling' },
              { id: 'risk', label: 'Risk & Alpha' },
              { id: 'overlap', label: 'ISIN Overlap & Correlation' },
              { id: 'stress', label: 'Debt & Stress' },
              { id: 'sip', label: 'SIP Wealth Simulator' },
              { id: 'factsheet', label: 'Fund Factsheets' },
              { id: 'python', label: 'Python Suite' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-400 font-bold underline underline-offset-4'
                    : 'hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsReconcileModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/70 rounded-lg border border-amber-800/70 transition-all"
              title="Inspect Nine-Preset AMFI Reconciliation Table"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">9-Preset AMFI Audit</span>
            </button>

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

      {/* Active Comparison Strip */}
      <section className="border-b border-slate-800/80 bg-[#0c1220] py-2 px-6">
        <div className="max-w-[1720px] mx-auto w-full flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-indigo-400" />
              Comparing ({selectedCodes.length}):
            </span>

            {activeFundsList.map((fund) => {
              const val = validationMap[fund.scheme_code];
              const effId = identityMap[fund.scheme_code] ?? fund.identityStatus;
              const isQuarantined = val?.quarantinedFromBreak;
              const isRuntimeHealthy = Boolean(effId.verified && (!val || val.usable));
              return (
                <div
                  key={fund.scheme_code}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs shadow-xs"
                >
                  {isRuntimeHealthy ? (
                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[150px] font-medium" title={`${fund.name} (${fund.isin ?? 'Unavailable'})`}>
                    {fund.name}
                  </span>
                  {isQuarantined && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/70">
                      Split Quarantine
                    </span>
                  )}
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      fund.asset_class === 'Debt'
                        ? 'bg-amber-950 text-amber-300'
                        : fund.asset_class === 'Hybrid'
                        ? 'bg-purple-950 text-purple-300'
                        : 'bg-indigo-950 text-indigo-300'
                    }`}
                  >
                    {fund.category}
                  </span>
                  {selectedCodes.length > 1 && (
                    <button
                      onClick={() => handleToggleFund(fund.scheme_code)}
                      className="p-0.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700 transition-colors"
                      title={`Remove ${fund.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fund</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>
              Benchmark:{' '}
              <span className={benchmarkStatus.available ? 'text-amber-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {benchmarkStatus.name} ({benchmarkStatus.available ? benchmarkStatus.variant : 'Unavailable'})
              </span>
            </span>
            <span>·</span>
            <span>
              Rf: <span className="text-emerald-400 font-semibold">{rfRate.toFixed(2)}%</span>
            </span>
            <span>·</span>
            <span>
              ADTV Limit: <span className="text-sky-400 font-semibold">{adtvParticipation}%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Main Workspace Canvas */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left Parameter Drawer */}
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
            <div className="text-[10px] text-amber-400/90 mt-1.5 leading-snug">
              Status: {benchmarkStatus.available ? `Verified (${benchmarkStatus.source})` : 'Unavailable (Batch 2 TRI feed pending)'}
            </div>
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
            <div className="text-[10px] text-slate-500 mt-0.5">Annualized Rf applied across risk &amp; exports</div>
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
            <div className="text-[10px] text-slate-500 mt-0.5">Modeled liquidity daily limit</div>
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-2">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Browse All Mutual Funds</span>
            </button>
            <button
              onClick={() => setIsReconcileModalOpen(true)}
              className="w-full py-2 bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 text-xs font-semibold rounded-lg border border-amber-800/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>View 9-Preset AMFI Audit</span>
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Safety & Validation Banners */}
          {(!benchmarkStatus.available || activeWarnings.length > 0) && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1.5">
              {!benchmarkStatus.available && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold">Benchmark Data Unavailable:</span> {benchmarkStatus.reason}{' '}
                    Validated fund-only returns, volatility, Sharpe, Sortino, drawdown, and Calmar remain active.
                  </span>
                </div>
              )}
              {activeWarnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2 text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 1: PERFORMANCE & ROLLING */}
          {activeTab === 'perf' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Cumulative Growth (Rebased to 100)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Normalized validated fund NAV series over {timeHorizon}-year window
                      {benchmarkStatus.available ? ` vs ${benchmarkStatus.name}.` : ' (Benchmark trace unavailable).'}
                    </p>
                  </div>
                  {isRefreshing && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating time-series...</span>
                    </div>
                  )}
                </div>

                <PerformanceChart
                  seriesMap={slicedPerfData.funds}
                  benchSeries={slicedPerfData.bench}
                  benchName={benchmarkStatus.name}
                  benchAvailable={benchmarkStatus.available}
                  benchReason={benchmarkStatus.reason}
                  colors={COLOR_PALETTE}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Trailing Returns */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-white">Trailing Returns &amp; CAGR (%) Matrix</h3>
                    <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
                      Corporate-Action Guarded
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Absolute returns for &lt;1Y; annualized CAGR for ≥1Y.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-right">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-sans">
                          <th className="py-2.5 text-left font-medium">Scheme / Benchmark</th>
                          <th className="py-2.5 px-2 font-medium">3M*</th>
                          <th className="py-2.5 px-2 font-medium">6M*</th>
                          <th className="py-2.5 px-2 font-medium">1Y</th>
                          <th className="py-2.5 px-2 font-medium">3Y</th>
                          <th className="py-2.5 px-2 font-medium">5Y</th>
                          <th className="py-2.5 px-2 font-medium">7Y</th>
                          <th className="py-2.5 px-2 font-medium">10Y</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeFundsList.map((fund) => {
                          const cagrMeta = trailingMetaMap[fund.scheme_code];
                          const cagr = cagrMeta?.values || {};
                          const reasons = cagrMeta?.unavailableReasons || {};
                          const renderCell = (key: string) => {
                            const val = cagr[key];
                            if (val === null || val === undefined) {
                              return (
                                <span className="text-slate-500 font-normal" title={reasons[key] || 'Unavailable'}>
                                  Unavailable
                                </span>
                              );
                            }
                            return (
                              <span className={val >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {formatOptNum(val, 2, '%', true)}
                              </span>
                            );
                          };
                          return (
                            <tr key={fund.scheme_code} className="hover:bg-slate-800/40">
                              <td className="py-2.5 text-left font-sans text-slate-200 font-medium truncate max-w-[180px]">
                                {fund.name}
                              </td>
                              <td className="py-2.5 px-2">{renderCell('3M')}</td>
                              <td className="py-2.5 px-2">{renderCell('6M')}</td>
                              <td className="py-2.5 px-2">{renderCell('1Y')}</td>
                              <td className="py-2.5 px-2">{renderCell('3Y')}</td>
                              <td className="py-2.5 px-2">{renderCell('5Y')}</td>
                              <td className="py-2.5 px-2">{renderCell('7Y')}</td>
                              <td className="py-2.5 px-2">{renderCell('10Y')}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-amber-950/20 font-semibold border-t-2 border-slate-700">
                          <td className="py-2.5 text-left font-sans text-amber-300">
                            {benchmarkStatus.name} (Bench)
                          </td>
                          {(['3M', '6M', '1Y', '3Y', '5Y', '7Y', '10Y'] as const).map((k) => (
                            <td key={k} className="py-2.5 px-2 text-amber-300 font-bold">
                              {benchmarkStatus.available && benchmarkCagrMeta.values[k] !== null && benchmarkCagrMeta.values[k] !== undefined ? (
                                formatOptNum(benchmarkCagrMeta.values[k], 2, '%', true)
                              ) : (
                                <span className="text-slate-500 font-normal" title={benchmarkStatus.reason || 'Unavailable'}>
                                  Unavailable
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
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
                      {benchmarkStatus.available
                        ? `Percentage of ${rollingWindowYears}Y rolling windows beating ${benchmarkStatus.name}.`
                        : `Unavailable — ${benchmarkStatus.reason}`}
                    </p>

                    <div className="space-y-3.5">
                      {rollingAnalysis.fundsRolling.map((fund) => {
                        const hit = fund.hitRate;
                        const isAvailable = hit !== null && fund.dist.available;
                        return (
                          <div key={fund.code} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-medium truncate max-w-[240px]">
                                {fund.name}
                              </span>
                              <span className="font-mono font-bold text-emerald-400">
                                {isAvailable ? (
                                  `${hit.toFixed(1)}%`
                                ) : (
                                  <span
                                    className="text-slate-500 font-normal"
                                    title={fund.dist.unavailableReason || benchmarkStatus.reason || 'Unavailable'}
                                  >
                                    Unavailable
                                  </span>
                                )}
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
                    {benchmarkStatus.available
                      ? `Evaluated over ${rollingAnalysis.benchDist.count} rolling benchmark trading windows.`
                      : 'Benchmark rolling windows unavailable until verified TRI source is connected.'}
                  </div>
                </div>
              </div>

              {/* Rolling Return Distributions Table & BoxPlot */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {rollingWindowYears}-Year Rolling Return Distribution &amp; Statistical Spread
                    </h3>
                    <p className="text-xs text-slate-400">
                      Evaluated across clean rolling windows (corporate-action break-spanning windows quarantined).
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
                          {f.dist.available && f.dist.count > 0 ? (
                            <>
                              <td className="py-2.5 px-2 text-emerald-400 font-bold">{formatOptNum(f.dist.mean, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-white font-bold">{formatOptNum(f.dist.median, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-rose-400">{formatOptNum(f.dist.min, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-sky-400 font-bold">{formatOptNum(f.dist.max, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-slate-300">{formatOptNum(f.dist.q25, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-slate-300">{formatOptNum(f.dist.q75, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-slate-400">{formatOptNum(f.dist.std, 2, '%')}</td>
                              <td className="py-2.5 px-2 text-emerald-400 font-bold">{formatOptNum(f.dist.pctPositive, 1, '%')}</td>
                            </>
                          ) : (
                            <td colSpan={8} className="py-2.5 px-2 text-center text-slate-500 font-sans italic">
                              Unavailable ({f.dist.unavailableReason || `Insufficient clean windows for ${rollingWindowYears}Y`})
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-amber-950/20 font-semibold border-t border-slate-700">
                        <td className="py-2.5 text-left font-sans text-amber-300">
                          {benchmarkStatus.name} (Bench)
                        </td>
                        {benchmarkStatus.available && rollingAnalysis.benchDist.available ? (
                          <>
                            <td className="py-2.5 px-2 text-amber-300">{formatOptNum(rollingAnalysis.benchDist.mean, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-amber-300">{formatOptNum(rollingAnalysis.benchDist.median, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-rose-400">{formatOptNum(rollingAnalysis.benchDist.min, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-amber-300">{formatOptNum(rollingAnalysis.benchDist.max, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-amber-300">{formatOptNum(rollingAnalysis.benchDist.q25, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-amber-300">{formatOptNum(rollingAnalysis.benchDist.q75, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-slate-400">{formatOptNum(rollingAnalysis.benchDist.std, 2, '%')}</td>
                            <td className="py-2.5 px-2 text-emerald-400 font-bold">{formatOptNum(rollingAnalysis.benchDist.pctPositive, 1, '%')}</td>
                          </>
                        ) : (
                          <td colSpan={8} className="py-2.5 px-2 text-center text-slate-500 font-sans italic font-normal">
                            Unavailable ({benchmarkStatus.reason})
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <RollingBoxPlot
                  distributions={[
                    ...(benchmarkStatus.available
                      ? [
                          {
                            name: benchmarkStatus.name,
                            dist: rollingAnalysis.benchDist,
                            color: '#f59e0b',
                          },
                        ]
                      : []),
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

          {/* TAB 2: RISK & ALPHA ENGINE */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Risk-Adjusted Ratios &amp; Active Alpha</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rf Applied = {rfRate.toFixed(2)}% · Benchmark = {benchmarkStatus.name} ({benchmarkStatus.available ? benchmarkStatus.variant : 'Unavailable'})
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
                      {riskMetricsList.map((m) => {
                        const cellNull = (reason?: string) => (
                          <span className="text-slate-500 font-normal" title={reason || 'Unavailable'}>
                            Unavailable
                          </span>
                        );
                        return (
                          <tr key={m.schemeCode} className="hover:bg-slate-800/40">
                            <td className="py-3 text-left font-sans text-slate-200 font-medium truncate max-w-[180px]">
                              {m.fundName}
                            </td>
                            <td className="py-3 px-2 text-emerald-400 font-bold">
                              {m.cagr !== null ? formatOptNum(m.cagr, 2, '%') : cellNull(m.unavailableReasons.fundOnly || m.unavailableReasons.corporateAction)}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {m.volatility !== null ? formatOptNum(m.volatility, 2, '%') : cellNull(m.unavailableReasons.fundOnly || m.unavailableReasons.corporateAction)}
                            </td>
                            <td className="py-3 px-2 font-bold text-sky-400">
                              {m.sharpe !== null ? formatOptNum(m.sharpe, 2) : cellNull(m.unavailableReasons.sharpe || m.unavailableReasons.fundOnly)}
                            </td>
                            <td className="py-3 px-2 font-bold text-emerald-400">
                              {m.sortino !== null ? formatOptNum(m.sortino, 2) : cellNull(m.unavailableReasons.sortino || m.unavailableReasons.fundOnly)}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {m.beta !== null ? formatOptNum(m.beta, 2) : cellNull(m.unavailableReasons.beta || m.unavailableReasons.benchmark)}
                            </td>
                            <td className={`py-3 px-2 font-bold ${m.jensensAlpha !== null && m.jensensAlpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {m.jensensAlpha !== null ? formatOptNum(m.jensensAlpha, 2, '%', true) : cellNull(m.unavailableReasons.jensensAlpha || m.unavailableReasons.benchmark)}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {m.rSquared !== null ? formatOptNum(m.rSquared, 3) : cellNull(m.unavailableReasons.rSquared || m.unavailableReasons.benchmark)}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {m.trackingError !== null ? formatOptNum(m.trackingError, 2, '%') : cellNull(m.unavailableReasons.benchmark)}
                            </td>
                            <td className="py-3 px-2 font-bold text-amber-400">
                              {m.informationRatio !== null ? formatOptNum(m.informationRatio, 2) : cellNull(m.unavailableReasons.informationRatio || m.unavailableReasons.benchmark)}
                            </td>
                            <td className="py-3 px-2 text-rose-400 font-semibold">
                              {m.maxDrawdown !== null ? formatOptNum(m.maxDrawdown, 2, '%') : cellNull(m.unavailableReasons.fundOnly || m.unavailableReasons.corporateAction)}
                            </td>
                            <td className="py-3 px-2 text-emerald-400 font-bold">
                              {m.calmarRatio !== null ? formatOptNum(m.calmarRatio, 2) : cellNull(m.unavailableReasons.calmarRatio || m.unavailableReasons.fundOnly)}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {m.upsideCapture !== null || m.downsideCapture !== null ? (
                                <>
                                  <span className="text-emerald-400">{m.upsideCapture !== null ? `${m.upsideCapture}%` : 'Unavailable'}</span>
                                  {' / '}
                                  <span className="text-amber-400">{m.downsideCapture !== null ? `${m.downsideCapture}%` : 'Unavailable'}</span>
                                </>
                              ) : (
                                cellNull(m.unavailableReasons.benchmark)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">Upside vs. Downside Capture Ratio Quadrant</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Benchmark-relative capture asymmetry (requires independent verified benchmark).
                  </p>
                  <CaptureRatioQuadrant metrics={riskMetricsList} />
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">Beta vs. Jensen&apos;s Alpha Scatter</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Bubble radius proportional to Information Ratio.
                  </p>
                  <BubbleScatterPlot metrics={riskMetricsList} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ISIN OVERLAP & CORRELATION */}
          {activeTab === 'overlap' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-base font-bold text-white tracking-tight">Pairwise ISIN-Level Holding Overlap Matrix</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Excludes cash &amp; TREPS; schemes without ingested disclosures report &ldquo;Unavailable&rdquo;. Genuine 0.0% indicates verified non-cash portfolios with no common stocks.
                  </p>
                </div>

                <OverlapHeatmap
                  available={overlapData.overlapAvailable}
                  exactAvailable={overlapData.overlapExactAvailable}
                  reason={overlapData.overlapReason}
                  names={overlapData.names}
                  matrix={overlapData.matrix}
                  observedSubsetMatrix={overlapData.observedSubsetMatrix}
                  coveragePctByFund={overlapData.coveragePctByFund}
                  unknownPctByFund={overlapData.unknownPctByFund}
                  cashPctByFund={overlapData.cashPctByFund}
                  nonCashPctByFund={overlapData.nonCashPctByFund}
                  rawTotalPctByFund={overlapData.rawTotalPctByFund}
                  coverageStatusByFund={overlapData.coverageStatusByFund}
                  coverageDetailByFund={overlapData.coverageDetailByFund}
                />
              </div>

              <CorrelationHeatmap
                available={overlapData.corrAvailable}
                reason={overlapData.corrReason}
                names={overlapData.corrNames}
                matrix={overlapData.corrMatrix}
                diversificationScore={overlapData.diversificationScore}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">Look-Through Market-Cap Breakdown</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    {overlapData.mcapExposure.isPartialSubset
                      ? overlapData.mcapExposure.reason
                      : 'Aggregate disclosed market-cap allocation across sourced portfolios.'}
                  </p>

                  {overlapData.mcapExposure.available ? (
                    <div className="space-y-3">
                      {overlapData.mcapExposure.isPartialSubset && (
                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 font-mono">
                          Covered Subset: {overlapData.mcapExposure.coveredWeightPct.toFixed(2)}% ({(overlapData.mcapExposure.nonCashWeightPct ?? overlapData.mcapExposure.coveredWeightPct).toFixed(2)}% securities + {(overlapData.mcapExposure.cashWeightPct ?? 0).toFixed(2)}% cash) | Unknown / Undisclosed: {overlapData.mcapExposure.unknownWeightPct.toFixed(2)}%
                        </div>
                      )}
                      {overlapData.mcapExposure.segments.map((item) => (
                        <div key={item.segment} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${item.segment === 'Unknown / Undisclosed' ? 'text-amber-300' : 'text-slate-300'}`}>
                              {item.segment}
                            </span>
                            <span className="font-mono font-bold text-slate-200">{item.weight.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, item.weight)}%`,
                                backgroundColor:
                                  item.segment === 'Large Cap'
                                    ? '#38bdf8'
                                    : item.segment === 'Mid Cap'
                                    ? '#10b981'
                                    : item.segment === 'Small Cap'
                                    ? '#f59e0b'
                                    : item.segment === 'Unknown / Undisclosed'
                                    ? '#64748b'
                                    : '#8b5cf6',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
                      {overlapData.mcapExposure.reason}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-white mb-1">Top Sector Concentrations</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    {overlapData.sectorExposure.isPartialSubset
                      ? overlapData.sectorExposure.reason
                      : 'Look-through industry sector exposures from verified holdings.'}
                  </p>

                  {overlapData.sectorExposure.available ? (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {overlapData.sectorExposure.isPartialSubset && (
                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 font-mono mb-2">
                          Covered Subset: {overlapData.sectorExposure.coveredWeightPct.toFixed(2)}% ({(overlapData.sectorExposure.nonCashWeightPct ?? overlapData.sectorExposure.coveredWeightPct).toFixed(2)}% securities + {(overlapData.sectorExposure.cashWeightPct ?? 0).toFixed(2)}% cash) | Unknown / Undisclosed: {overlapData.sectorExposure.unknownWeightPct.toFixed(2)}%
                        </div>
                      )}
                      {(() => {
                        const allSectors = overlapData.sectorExposure.sectors;
                        const topKnown = allSectors
                          .filter((s) => s.sector !== 'Unknown / Undisclosed')
                          .slice(0, 10);
                        const unknownItem = allSectors.find(
                          (s) => s.sector === 'Unknown / Undisclosed'
                        );
                        return unknownItem ? [...topKnown, unknownItem] : topKnown;
                      })().map((item) => (
                        <div key={item.sector} className="flex items-center justify-between text-xs">
                          <span className={`font-medium truncate max-w-[200px] ${item.sector === 'Unknown / Undisclosed' ? 'text-amber-300' : 'text-slate-300'}`}>
                            {item.sector}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${item.sector === 'Unknown / Undisclosed' ? 'bg-slate-500' : 'bg-emerald-500'}`}
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
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
                      {overlapData.sectorExposure.reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DEBT & LIQUIDITY STRESS */}
          {activeTab === 'stress' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Modeled Portfolio Liquidity Stress</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Scenario model under {adtvParticipation}% 30D ADTV limit (requires sourced holdings &amp; exchange ADTV).
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

                {!liquidityResult.available && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                    {liquidityResult.reason}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Fund AUM</div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {targetStressFund.aum_cr !== null ? `₹${targetStressFund.aum_cr.toLocaleString()} Cr` : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{targetStressFund.category}</div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Days to Liquidate 25%</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {liquidityResult.available && liquidityResult.days25Waterfall !== null
                        ? `${liquidityResult.days25Waterfall} Days`
                        : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Pro-Rata:{' '}
                      {liquidityResult.available && liquidityResult.days25Prorata !== null
                        ? `${liquidityResult.days25Prorata} Days`
                        : 'Unavailable'}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Days to Liquidate 50%</div>
                    <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {liquidityResult.available && liquidityResult.days50Waterfall !== null
                        ? `${liquidityResult.days50Waterfall} Days`
                        : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Pro-Rata:{' '}
                      {liquidityResult.available && liquidityResult.days50Prorata !== null
                        ? `${liquidityResult.days50Prorata} Days`
                        : 'Unavailable'}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Illiquid Basket (&gt;10d)</div>
                    <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                      {liquidityResult.available && liquidityResult.pctIlliquidOver10Days !== null
                        ? `${liquidityResult.pctIlliquidOver10Days.toFixed(1)}%`
                        : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Under 3 Days:{' '}
                      {liquidityResult.available && liquidityResult.pctLiquidUnder3Days !== null
                        ? `${liquidityResult.pctLiquidUnder3Days.toFixed(1)}%`
                        : 'Unavailable'}
                    </div>
                  </div>
                </div>

                {liquidityResult.holdings.length > 0 && (
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
                            <td className="py-2 text-right text-slate-400">
                              {h.adtvCr !== null ? `₹${h.adtvCr.toFixed(0)} Cr` : 'Unavailable'}
                            </td>
                            <td className="py-2 text-right text-slate-400">
                              {h.daysToLiquidate !== null ? `${h.daysToLiquidate.toFixed(1)} d` : 'Unavailable'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Debt Duration Shock Engine */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Debt Duration &amp; Yield Curve Shock Engine</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Requires sourced Macaulay Duration and YTM (placeholder debt defaults disabled).
                  </p>
                </div>

                {durationResult.available && customShockResult.available ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono text-right">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-sans">
                            <th className="py-2 text-left">Yield Shift</th>
                            <th className="py-2 px-2">Duration Effect</th>
                            <th className="py-2 px-2">Total NAV Change</th>
                            <th className="py-2 px-2">Simulated NAV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {durationResult.points.map((s) => (
                            <tr key={s.shockBps} className="hover:bg-slate-800/40">
                              <td className="py-2 text-left font-sans text-slate-300 font-medium">
                                {s.shockBps > 0 ? `+${s.shockBps} bps` : `${s.shockBps} bps`}
                              </td>
                              <td className="py-2 px-2 text-slate-400">{s.durationImpactPct.toFixed(2)}%</td>
                              <td className={`py-2 px-2 font-bold ${s.totalNavChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatOptNum(s.totalNavChangePct, 2, '%', true)}
                              </td>
                              <td className="py-2 px-2 font-bold text-white">₹{s.simulatedNav.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

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
                          <div className="text-xs text-slate-400 uppercase font-medium">First-Order Duration Impact</div>
                          <div className={`text-2xl font-bold font-mono ${customShockResult.durImpactPct! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatOptNum(customShockResult.durImpactPct, 2, '%', true)}
                          </div>
                          <div className="text-xs font-mono text-slate-300">
                            Simulated NAV: ₹{customShockResult.simulatedNav!.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                    {durationResult.reason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SIP SIMULATOR */}
          {activeTab === 'sip' && (
            <div className="space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Systematic Investment Plan (SIP) Simulator</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Simulated strictly on validated scheme NAVs (no benchmark substitution when scheme history is unavailable).
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
                      {sipResult.available && sipResult.totalCorpus !== null
                        ? `₹${sipResult.totalCorpus.toLocaleString()}`
                        : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {sipResult.available && sipResult.totalInvested !== null && sipResult.absoluteProfit !== null
                        ? `Invested: ₹${sipResult.totalInvested.toLocaleString()} · Net Gain: ₹${sipResult.absoluteProfit.toLocaleString()}`
                        : sipResult.reason}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Annualized XIRR</div>
                    <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                      {sipResult.available && sipResult.xirrPct !== null
                        ? `${sipResult.xirrPct}%`
                        : 'Unavailable'}
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

          {/* TAB 6: FUND FACTSHEETS */}
          {activeTab === 'factsheet' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Fund Factsheets &amp; Verified Identity Dossiers</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Displays dated AMC disclosures where available; unsourced facts on discovered funds report &ldquo;Unavailable&rdquo;.
                  </p>
                </div>

                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Browse More Schemes</span>
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
                          {fund.fund_house} · ISIN: {fund.isin ?? 'Unavailable'}
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
                        <div className="font-mono font-bold text-white mt-0.5">
                          {fund.aum_cr !== null ? `₹${fund.aum_cr.toLocaleString()} Cr` : 'Unavailable'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-950/80 rounded-lg">
                        <div className="text-slate-400 text-[10px]">TER (Direct)</div>
                        <div className="font-mono font-bold text-emerald-400 mt-0.5">
                          {fund.expense_ratio_direct !== null ? `${fund.expense_ratio_direct}%` : 'Unavailable'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-950/80 rounded-lg">
                        <div className="text-slate-400 text-[10px]">Turnover</div>
                        <div className="font-mono font-bold text-amber-400 mt-0.5">
                          {fund.turnover_ratio_pct !== null ? `${fund.turnover_ratio_pct}%` : 'Unavailable'}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-lg space-y-1 text-xs">
                      {fund.manager ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{fund.manager.name}</span>
                            <span className="font-mono text-emerald-400 text-[11px] font-semibold">
                              {fund.manager.tenureYears !== null ? `${fund.manager.tenureYears} yrs` : 'Unavailable'}
                            </span>
                          </div>
                          {fund.manager.bio && (
                            <p className="text-slate-400 line-clamp-2 text-[11px] leading-relaxed">{fund.manager.bio}</p>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 italic text-[11px]">
                          Fund manager profile: Unavailable (no AMC factsheet disclosure ingested)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                      <span>
                        Riskometer:{' '}
                        <span className="font-semibold text-slate-200">{fund.riskometer ?? 'Unavailable'}</span>
                      </span>
                      <span>
                        Min SIP:{' '}
                        <span className="font-mono font-semibold text-white">
                          {fund.min_sip_inr !== null ? `₹${fund.min_sip_inr}` : 'Unavailable'}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: PYTHON SUITE */}
          {activeTab === 'python' && (
            <div className="space-y-6">
              <PythonExporter />
            </div>
          )}
        </main>
      </div>

      {/* Nine-Preset AMFI Reconciliation Modal */}
      {isReconcileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-5xl max-h-[88vh] bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Nine-Preset Reconciliation vs. AMFI Snapshot ({AMFI_SNAPSHOT_DATE})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audited presets vs. official AMFI identities. Cross-scheme mismatches, missing reports, and unverified plans are blocked from analytics selection.
                </p>
              </div>
              <button
                onClick={() => setIsReconcileModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2">Code</th>
                    <th className="py-2 px-2">Audited Preset</th>
                    <th className="py-2 px-2">AMFI Official Match</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Audit Resolution Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {Object.values(PRESET_RECONCILIATION_TABLE).map((rec) => (
                    <tr key={rec.scheme_code} className="hover:bg-slate-900/50 align-top">
                      <td className="py-2.5 px-2 font-mono font-bold text-indigo-400">{rec.scheme_code}</td>
                      <td className="py-2.5 px-2">
                        <div className="text-slate-200 font-medium">{rec.auditedPresetName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{rec.auditedPresetIsin}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="text-slate-200">{rec.amfiName ?? 'Absent from AMFI snapshot'}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {rec.amfiIsin ?? 'No ISIN'} · {rec.amfiNav !== null ? `NAV ₹${rec.amfiNav}` : 'No NAV'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            rec.selectable
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/70'
                              : 'bg-rose-950/70 text-rose-300 border border-rose-800/70'
                          }`}
                        >
                          {rec.selectable ? rec.resolutionStatus.replace(/_/g, ' ') : 'Blocked / Unavailable'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300 max-w-xs leading-relaxed">{rec.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
              <button
                onClick={() => setIsReconcileModalOpen(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                Close Audit Table
              </button>
            </div>
          </div>
        </div>
      )}

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
        trailingMetaMap={trailingMetaMap}
        seriesMap={fundSeriesMap}
        validationMap={validationMap}
        identityMap={identityMap}
        holdingsOverlap={overlapData.overlapMatrixResult}
        benchmarkStatus={benchmarkStatus}
        rfRate={rfRate}
      />
    </div>
  );
}
