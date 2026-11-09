import React, { useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Check, Database } from 'lucide-react';
import { FundMeta, NavPoint, RiskMetrics } from '../types/quant';

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

  if (!isOpen) return null;

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
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // 1. Export Full Comparison Summary CSV
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
      'Manager Name',
      'Manager Tenure (Yrs)',
      '1Y CAGR (%)',
      '3Y CAGR (%)',
      '5Y CAGR (%)',
      '7Y CAGR (%)',
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
    ];

    const rows = selectedFunds.map((fund) => {
      const rm = riskMetrics.find((r) => r.schemeCode === fund.scheme_code);
      const cagr = trailingCagrMap[fund.scheme_code] || {};
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
        `"${fund.manager.name}"`,
        fund.manager.tenureYears,
        cagr['1Y'] ?? '',
        cagr['3Y'] ?? '',
        cagr['5Y'] ?? '',
        cagr['7Y'] ?? '',
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
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    triggerDownload(`mutual_funds_comparison_${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv');
  };

  // 2. Export Structured JSON
  const handleExportComparisonJson = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      benchmark: benchmarkName,
      funds: selectedFunds.map((fund) => {
        const rm = riskMetrics.find((r) => r.schemeCode === fund.scheme_code);
        const cagr = trailingCagrMap[fund.scheme_code] || {};
        return {
          meta: fund,
          trailingCagr: cagr,
          riskMetrics: rm,
          holdings: fund.holdings,
        };
      }),
    };
    const jsonContent = JSON.stringify(payload, null, 2);
    triggerDownload(`mutual_funds_analytics_${new Date().toISOString().slice(0, 10)}.json`, jsonContent, 'application/json');
  };

  // 3. Export Raw Aligned Daily NAV Series CSV
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
    triggerDownload(`mutual_funds_daily_nav_timeseries_${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Mutual Fund Analytics Data</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Download complete quantitative metrics, qualitative factsheets, and raw historical time series.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Downloaded <code className="font-mono">{downloadSuccess}</code></span>
            </div>
          )}

          {/* Option 1: CSV Comparison Summary */}
          <div
            onClick={handleExportComparisonCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Full Comparison Report (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Complete quantitative matrix (CAGR, Sharpe, Beta, Drawdowns) + manager qualitative facts.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors">
              CSV
            </button>
          </div>

          {/* Option 2: Full Structured JSON */}
          <div
            onClick={handleExportComparisonJson}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Structured Analytics Package (JSON)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Full nested JSON schema with metadata, holdings, rolling distributions, and risk ratios.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors">
              JSON
            </button>
          </div>

          {/* Option 3: Raw Daily NAV Timeseries */}
          <div
            onClick={handleExportRawNavCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Raw Daily NAV Series (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Aligned multi-scheme daily time-series with benchmark for Python/Excel quantitative modeling.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors">
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
