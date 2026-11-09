import React, { useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Check, Database, Sparkles, ChevronDown } from 'lucide-react';
import { FundMeta, NavPoint, RiskMetrics, RollingDistribution } from '../types/quant';
import { computeRollingReturns, computeBenchmarkHitRate } from '../utils/quantEngine';

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFunds: FundMeta[];
  riskMetrics: RiskMetrics[];
  trailingCagrMap: Record<number, Record<string, number | undefined>>;
  seriesMap: Record<number, NavPoint[]>;
  benchmarkSeries: NavPoint[];
  benchmarkName: string;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  selectedFunds,
  riskMetrics,
  trailingCagrMap,
  seriesMap,
  benchmarkSeries,
  benchmarkName,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [individualFundCode, setIndividualFundCode] = useState<number>(
    selectedFunds[0]?.scheme_code || 122639
  );

  if (!isOpen) return null;

  // Sanitizer: converts fund names to filesystem-safe string
  const sanitizeName = (name: string): string => {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  };

  // Format current datetime: YYYY-MM-DD_HH-mm-ss
  const getFormattedDateTime = (): string => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;
  };

  // Generate dynamic, descriptive filename based on selected funds and timestamp
  const getExportFilename = (prefix: string, extension: string, singleFundName?: string): string => {
    const timestamp = getFormattedDateTime();

    if (singleFundName) {
      return `${prefix}_${sanitizeName(singleFundName)}_${timestamp}.${extension}`;
    }

    if (selectedFunds.length === 1) {
      return `${prefix}_${sanitizeName(selectedFunds[0].name)}_${timestamp}.${extension}`;
    }

    if (selectedFunds.length === 2) {
      return `${prefix}_${sanitizeName(selectedFunds[0].name)}_vs_${sanitizeName(selectedFunds[1].name)}_${timestamp}.${extension}`;
    }

    if (selectedFunds.length === 3) {
      return `${prefix}_${sanitizeName(selectedFunds[0].name)}_${sanitizeName(selectedFunds[1].name)}_${sanitizeName(selectedFunds[2].name)}_${timestamp}.${extension}`;
    }

    // Greater than 3 funds: include portfolio count and lead fund name
    const leadName = sanitizeName(selectedFunds[0].name);
    return `${prefix}_Portfolio_${selectedFunds.length}_Funds_${leadName}_${timestamp}.${extension}`;
  };

  const triggerDownload = (filename: string, content: string, type: 'text/csv' | 'application/json') => {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  // Compute 1Y, 3Y, 5Y, 7Y rolling distributions & hit rates for each fund
  const getRollingAnalyticsForFund = (schemeCode: number) => {
    const series = seriesMap[schemeCode] || [];
    const r1 = computeRollingReturns(series, 1.0);
    const r3 = computeRollingReturns(series, 3.0);
    const r5 = computeRollingReturns(series, 5.0);
    const r7 = computeRollingReturns(series, 7.0);

    const b1 = computeRollingReturns(benchmarkSeries, 1.0);
    const b3 = computeRollingReturns(benchmarkSeries, 3.0);
    const b5 = computeRollingReturns(benchmarkSeries, 5.0);
    const b7 = computeRollingReturns(benchmarkSeries, 7.0);

    const hit1 = computeBenchmarkHitRate(r1.series, b1.series);
    const hit3 = computeBenchmarkHitRate(r3.series, b3.series);
    const hit5 = computeBenchmarkHitRate(r5.series, b5.series);
    const hit7 = computeBenchmarkHitRate(r7.series, b7.series);

    return {
      r1, r3, r5, r7,
      hit1, hit3, hit5, hit7,
    };
  };

  // 1. Export Full Comparison Summary CSV with COMPLETE metrics
  const handleExportComparisonCsv = () => {
    const headers = [
      'Scheme Code',
      'Scheme Name',
      'Category',
      'Asset Class',
      'Fund House',
      'Benchmark',
      'AUM (Cr INR)',
      'Direct TER (%)',
      'Turnover (%)',
      'Riskometer',
      'Inception Date',
      'Manager Name',
      'Manager Tenure (Yrs)',
      // Trailing Returns
      '3M Return (%)',
      '6M Return (%)',
      '1Y CAGR (%)',
      '3Y CAGR (%)',
      '5Y CAGR (%)',
      '7Y CAGR (%)',
      '10Y CAGR (%)',
      // Risk Ratios
      'Annualized Volatility (%)',
      'Sharpe Ratio',
      'Sortino Ratio',
      'Beta',
      "Jensen's Alpha (%)",
      'R-Squared',
      'Tracking Error (%)',
      'Information Ratio',
      'Max Drawdown (%)',
      'Recovery Period (Days)',
      'Calmar Ratio',
      'Upside Capture (%)',
      'Downside Capture (%)',
      // 1Y Rolling Stats
      '1Y Rolling Mean (%)',
      '1Y Rolling Median (%)',
      '1Y Rolling Min (%)',
      '1Y Rolling Max (%)',
      '1Y Rolling 25th %ile',
      '1Y Rolling 75th %ile',
      '1Y Rolling Std Dev',
      '1Y Rolling % Positive',
      '1Y Rolling Benchmark Hit Rate (%)',
      // 3Y Rolling Stats
      '3Y Rolling Mean (%)',
      '3Y Rolling Median (%)',
      '3Y Rolling Min (%)',
      '3Y Rolling Max (%)',
      '3Y Rolling 25th %ile',
      '3Y Rolling 75th %ile',
      '3Y Rolling Std Dev',
      '3Y Rolling % Positive',
      '3Y Rolling Benchmark Hit Rate (%)',
      // 5Y Rolling Stats
      '5Y Rolling Mean (%)',
      '5Y Rolling Median (%)',
      '5Y Rolling Min (%)',
      '5Y Rolling Max (%)',
      '5Y Rolling 25th %ile',
      '5Y Rolling 75th %ile',
      '5Y Rolling Std Dev',
      '5Y Rolling % Positive',
      '5Y Rolling Benchmark Hit Rate (%)',
      // 7Y Rolling Stats
      '7Y Rolling Mean (%)',
      '7Y Rolling Median (%)',
      '7Y Rolling Min (%)',
      '7Y Rolling Max (%)',
      '7Y Rolling 25th %ile',
      '7Y Rolling 75th %ile',
      '7Y Rolling Std Dev',
      '7Y Rolling % Positive',
      '7Y Rolling Benchmark Hit Rate (%)',
    ];

    const rows = selectedFunds.map((fund) => {
      const rm = riskMetrics.find((r) => r.schemeCode === fund.scheme_code);
      const cagr = trailingCagrMap[fund.scheme_code] || {};
      const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(fund.scheme_code);

      return [
        fund.scheme_code,
        `"${fund.name}"`,
        `"${fund.category}"`,
        fund.asset_class,
        `"${fund.fund_house}"`,
        `"${fund.benchmark_symbol}"`,
        fund.aum_cr,
        fund.expense_ratio_direct,
        fund.turnover_ratio_pct,
        fund.riskometer,
        fund.inception_date,
        `"${fund.manager.name}"`,
        fund.manager.tenureYears,
        cagr['3M'] ?? 'N/A',
        cagr['6M'] ?? 'N/A',
        cagr['1Y'] ?? 'N/A',
        cagr['3Y'] ?? 'N/A',
        cagr['5Y'] ?? 'N/A',
        cagr['7Y'] ?? 'N/A',
        cagr['10Y'] ?? 'N/A',
        rm?.volatility ?? '',
        rm?.sharpe ?? '',
        rm?.sortino ?? '',
        rm?.beta ?? '',
        rm?.jensensAlpha ?? '',
        rm?.rSquared ?? '',
        rm?.trackingError ?? '',
        rm?.informationRatio ?? '',
        rm?.maxDrawdown ?? '',
        rm?.recoveryDays ?? '',
        rm?.calmarRatio ?? '',
        rm?.upsideCapture ?? '',
        rm?.downsideCapture ?? '',
        // 1Y Rolling
        r1.count > 0 ? r1.mean : 'N/A',
        r1.count > 0 ? r1.median : 'N/A',
        r1.count > 0 ? r1.min : 'N/A',
        r1.count > 0 ? r1.max : 'N/A',
        r1.count > 0 ? r1.q25 : 'N/A',
        r1.count > 0 ? r1.q75 : 'N/A',
        r1.count > 0 ? r1.std : 'N/A',
        r1.count > 0 ? r1.pctPositive : 'N/A',
        hit1 !== undefined ? hit1 : 'N/A',
        // 3Y Rolling
        r3.count > 0 ? r3.mean : 'N/A',
        r3.count > 0 ? r3.median : 'N/A',
        r3.count > 0 ? r3.min : 'N/A',
        r3.count > 0 ? r3.max : 'N/A',
        r3.count > 0 ? r3.q25 : 'N/A',
        r3.count > 0 ? r3.q75 : 'N/A',
        r3.count > 0 ? r3.std : 'N/A',
        r3.count > 0 ? r3.pctPositive : 'N/A',
        hit3 !== undefined ? hit3 : 'N/A',
        // 5Y Rolling
        r5.count > 0 ? r5.mean : 'N/A',
        r5.count > 0 ? r5.median : 'N/A',
        r5.count > 0 ? r5.min : 'N/A',
        r5.count > 0 ? r5.max : 'N/A',
        r5.count > 0 ? r5.q25 : 'N/A',
        r5.count > 0 ? r5.q75 : 'N/A',
        r5.count > 0 ? r5.std : 'N/A',
        r5.count > 0 ? r5.pctPositive : 'N/A',
        hit5 !== undefined ? hit5 : 'N/A',
        // 7Y Rolling
        r7.count > 0 ? r7.mean : 'N/A',
        r7.count > 0 ? r7.median : 'N/A',
        r7.count > 0 ? r7.min : 'N/A',
        r7.count > 0 ? r7.max : 'N/A',
        r7.count > 0 ? r7.q25 : 'N/A',
        r7.count > 0 ? r7.q75 : 'N/A',
        r7.count > 0 ? r7.std : 'N/A',
        r7.count > 0 ? r7.pctPositive : 'N/A',
        hit7 !== undefined ? hit7 : 'N/A',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = getExportFilename('MF_Comparison', 'csv');
    triggerDownload(filename, csvContent, 'text/csv');
  };

  // 2. Export Structured JSON with COMPLETE nested metrics
  const handleExportComparisonJson = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      benchmark: benchmarkName,
      funds: selectedFunds.map((fund) => {
        const rm = riskMetrics.find((r) => r.schemeCode === fund.scheme_code);
        const cagr = trailingCagrMap[fund.scheme_code] || {};
        const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(fund.scheme_code);

        return {
          meta: fund,
          trailingReturns: cagr,
          riskMetrics: rm,
          rollingDistributions: {
            '1Year': { ...r1, hitRatePct: hit1 },
            '3Year': { ...r3, hitRatePct: hit3 },
            '5Year': { ...r5, hitRatePct: hit5 },
            ...(r7.count > 0 ? { '7Year': { ...r7, hitRatePct: hit7 } } : {}),
          },
          holdings: fund.holdings,
        };
      }),
    };
    const jsonContent = JSON.stringify(payload, null, 2);
    const filename = getExportFilename('MF_Analytics', 'json');
    triggerDownload(filename, jsonContent, 'application/json');
  };

  // 3. Export Single Fund Detailed Factsheet & Portfolio CSV
  const handleExportSingleFundCsv = () => {
    const fund = selectedFunds.find((f) => f.scheme_code === individualFundCode) || selectedFunds[0];
    if (!fund) return;

    const rm = riskMetrics.find((r) => r.schemeCode === fund.scheme_code);
    const cagr = trailingCagrMap[fund.scheme_code] || {};
    const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(fund.scheme_code);

    const lines: string[] = [
      `"FUND FACTSHEET & QUANTITATIVE DOSSIER"`,
      `"Export Date","${new Date().toISOString()}"`,
      `"Scheme Name","${fund.name}"`,
      `"Scheme Code","${fund.scheme_code}"`,
      `"Category","${fund.category}"`,
      `"Asset Class","${fund.asset_class}"`,
      `"Fund House","${fund.fund_house}"`,
      `"Benchmark","${fund.benchmark_symbol}"`,
      `"Inception Date","${fund.inception_date}"`,
      `"AUM (Cr INR)","${fund.aum_cr}"`,
      `"Direct TER (%)","${fund.expense_ratio_direct}"`,
      `"Turnover Ratio (%)","${fund.turnover_ratio_pct}"`,
      `"Riskometer","${fund.riskometer}"`,
      `"Lead Manager","${fund.manager.name}"`,
      `"Manager Tenure (Years)","${fund.manager.tenureYears}"`,
      ``,
      `"TRAILING RETURNS"`,
      `"Period","Return / CAGR (%)"`,
      `"3 Months (Absolute)","${cagr['3M'] ?? 'N/A'}"`,
      `"6 Months (Absolute)","${cagr['6M'] ?? 'N/A'}"`,
      `"1 Year (CAGR)","${cagr['1Y'] ?? 'N/A'}"`,
      `"3 Years (CAGR)","${cagr['3Y'] ?? 'N/A'}"`,
      `"5 Years (CAGR)","${cagr['5Y'] ?? 'N/A'}"`,
      `"7 Years (CAGR)","${cagr['7Y'] ?? 'N/A'}"`,
      `"10 Years (CAGR)","${cagr['10Y'] ?? 'N/A'}"`,
      ``,
      `"ROLLING RETURN DISTRIBUTIONS & HIT RATES"`,
      `"Window","Mean (%)","Median (%)","Min (%)","Max (%)","25th %ile","75th %ile","Std Dev","% Positive Windows","Benchmark Hit Rate (%)"`,
      `"1-Year Rolling","${r1.count > 0 ? r1.mean : 'N/A'}","${r1.count > 0 ? r1.median : 'N/A'}","${r1.count > 0 ? r1.min : 'N/A'}","${r1.count > 0 ? r1.max : 'N/A'}","${r1.count > 0 ? r1.q25 : 'N/A'}","${r1.count > 0 ? r1.q75 : 'N/A'}","${r1.count > 0 ? r1.std : 'N/A'}","${r1.count > 0 ? r1.pctPositive + '%' : 'N/A'}","${hit1 !== undefined ? hit1 + '%' : 'N/A'}"`,
      `"3-Year Rolling","${r3.count > 0 ? r3.mean : 'N/A'}","${r3.count > 0 ? r3.median : 'N/A'}","${r3.count > 0 ? r3.min : 'N/A'}","${r3.count > 0 ? r3.max : 'N/A'}","${r3.count > 0 ? r3.q25 : 'N/A'}","${r3.count > 0 ? r3.q75 : 'N/A'}","${r3.count > 0 ? r3.std : 'N/A'}","${r3.count > 0 ? r3.pctPositive + '%' : 'N/A'}","${hit3 !== undefined ? hit3 + '%' : 'N/A'}"`,
      `"5-Year Rolling","${r5.count > 0 ? r5.mean : 'N/A'}","${r5.count > 0 ? r5.median : 'N/A'}","${r5.count > 0 ? r5.min : 'N/A'}","${r5.count > 0 ? r5.max : 'N/A'}","${r5.count > 0 ? r5.q25 : 'N/A'}","${r5.count > 0 ? r5.q75 : 'N/A'}","${r5.count > 0 ? r5.std : 'N/A'}","${r5.count > 0 ? r5.pctPositive + '%' : 'N/A'}","${hit5 !== undefined ? hit5 + '%' : 'N/A'}"`,
      `"7-Year Rolling","${r7.count > 0 ? r7.mean : 'N/A'}","${r7.count > 0 ? r7.median : 'N/A'}","${r7.count > 0 ? r7.min : 'N/A'}","${r7.count > 0 ? r7.max : 'N/A'}","${r7.count > 0 ? r7.q25 : 'N/A'}","${r7.count > 0 ? r7.q75 : 'N/A'}","${r7.count > 0 ? r7.std : 'N/A'}","${r7.count > 0 ? r7.pctPositive + '%' : 'N/A'}","${hit7 !== undefined ? hit7 + '%' : 'N/A'}"`,
      ``,
      `"RISK RATIOS & ACTIVE METRICS"`,
      `"Metric","Value"`,
      `"Annualized Volatility (%)","${rm?.volatility ?? ''}"`,
      `"Sharpe Ratio","${rm?.sharpe ?? ''}"`,
      `"Sortino Ratio","${rm?.sortino ?? ''}"`,
      `"Beta","${rm?.beta ?? ''}"`,
      `"Jensen's Alpha (%)","${rm?.jensensAlpha ?? ''}"`,
      `"R-Squared","${rm?.rSquared ?? ''}"`,
      `"Tracking Error (%)","${rm?.trackingError ?? ''}"`,
      `"Information Ratio","${rm?.informationRatio ?? ''}"`,
      `"Maximum Drawdown (%)","${rm?.maxDrawdown ?? ''}"`,
      `"Recovery Period (Days)","${rm?.recoveryDays ?? ''}"`,
      `"Calmar Ratio","${rm?.calmarRatio ?? ''}"`,
      `"Upside Capture (%)","${rm?.upsideCapture ?? ''}"`,
      `"Downside Capture (%)","${rm?.downsideCapture ?? ''}"`,
      ``,
      `"PORTFOLIO HOLDINGS & LIQUIDITY"`,
      `"ISIN","Security Name","Sector","Market Cap","Weight (%)","30D ADTV (Cr INR)"`,
      ...fund.holdings.map((h) => `"${h.isin}","${h.name}","${h.sector}","${h.mcap}",${h.weight},${h.adtv_cr}`),
    ];

    const csvContent = lines.join('\n');
    const filename = getExportFilename('MF_Factsheet', 'csv', fund.name);
    triggerDownload(filename, csvContent, 'text/csv');
  };

  // 4. Export Raw Daily NAV Series CSV
  const handleExportRawNavCsv = () => {
    const benchMap = new Map(benchmarkSeries.map((p) => [p.date, p.nav]));
    const dates = benchmarkSeries.map((p) => p.date).sort();

    const headers = ['Date', `Benchmark (${benchmarkName})`, ...selectedFunds.map((f) => `"${f.name}"`)];
    const rows: string[] = [];

    dates.forEach((d) => {
      const bNav = benchMap.get(d) ?? '';
      const fundNavs = selectedFunds.map((f) => {
        const series = seriesMap[f.scheme_code];
        const point = series?.find((p) => p.date === d);
        return point ? point.nav : '';
      });
      rows.push([d, bNav, ...fundNavs].join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = getExportFilename('MF_Daily_NAV_Timeseries', 'csv');
    triggerDownload(filename, csvContent, 'text/csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Mutual Fund Analytics</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Includes descriptive fund names, creation timestamps, and complete rolling distributions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3.5">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Downloaded: <code className="font-mono font-semibold text-emerald-200">{downloadSuccess}</code></span>
            </div>
          )}

          {/* Option 1: Full Comparison CSV */}
          <div
            onClick={handleExportComparisonCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Full Comparison Report (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Complete 1Y/3Y/5Y rolling statistics, hit rates, trailing CAGRs, and risk metrics.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              CSV
            </button>
          </div>

          {/* Option 2: Full Structured JSON */}
          <div
            onClick={handleExportComparisonJson}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Complete Analytics Package (JSON)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Structured payload with nested 1Y/3Y/5Y rolling distributions, holdings, and metadata.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              JSON
            </button>
          </div>

          {/* Option 3: Individual Fund Factsheet Dossier */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Single Fund Detailed Dossier (CSV)</span>
              </div>
              <button
                onClick={handleExportSingleFundCsv}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-semibold rounded-lg text-white transition-colors shadow-sm"
              >
                Download Factsheet
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={individualFundCode}
                onChange={(e) => setIndividualFundCode(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {selectedFunds.map((f) => (
                  <option key={f.scheme_code} value={f.scheme_code}>
                    {f.name} ({f.category})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] text-slate-400">
              Filename will be: <code className="text-amber-300 font-mono text-[10px]">MF_{sanitizeName(selectedFunds.find(f => f.scheme_code === individualFundCode)?.name || 'Fund')}_[datetime].csv</code>
            </div>
          </div>

          {/* Option 4: Raw Daily NAV Timeseries */}
          <div
            onClick={handleExportRawNavCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Raw Daily NAV Matrix (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Aligned multi-scheme daily time-series with benchmark for Excel / Python modeling.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              NAV CSV
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div>Exporting {selectedFunds.length} active comparison funds</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
