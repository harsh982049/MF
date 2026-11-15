import React, { useState } from 'react';
import { RollingDistribution, RiskMetrics, SipSimulationResult } from '../types/quant';

/**
 * Rebased Cumulative Performance Line Chart (Base = 100)
 * Continues to plot validated fund lines cleanly even when Benchmark is Unavailable.
 */
interface PerformanceChartProps {
  seriesMap: Record<string, { date: string; nav: number }[]>;
  benchSeries: { date: string; nav: number }[];
  benchName: string;
  benchAvailable: boolean;
  benchReason?: string | null;
  colors: string[];
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  seriesMap,
  benchSeries,
  benchName,
  benchAvailable,
  benchReason,
  colors,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const fundKeys = Object.keys(seriesMap).filter((k) => seriesMap[k] && seriesMap[k].length > 0);
  const hasBench = benchAvailable && benchSeries && benchSeries.length > 0;

  if (fundKeys.length === 0 && !hasBench) {
    return (
      <div className="p-8 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Performance Chart — Unavailable
        </div>
        <div className="text-xs text-slate-500">
          {benchReason || 'No validated fund or benchmark series available in selected horizon.'}
        </div>
      </div>
    );
  }

  // Build master date axis from benchmark (if available) + all fund series
  const allDatesSet = new Set<string>();
  if (hasBench) benchSeries.forEach((p) => allDatesSet.add(p.date));
  fundKeys.forEach((k) => seriesMap[k].forEach((p) => allDatesSet.add(p.date)));
  const dates = Array.from(allDatesSet).sort();

  const normBenchMap = new Map<string, number>();
  if (hasBench) {
    const baseB = benchSeries[0].nav;
    benchSeries.forEach((p) => normBenchMap.set(p.date, (p.nav / baseB) * 100));
  }

  const normFundMaps: Record<string, Map<string, number>> = {};
  fundKeys.forEach((k) => {
    const s = seriesMap[k];
    const baseF = s[0].nav;
    const m = new Map<string, number>();
    s.forEach((p) => m.set(p.date, (p.nav / baseF) * 100));
    normFundMaps[k] = m;
  });

  let minVal = 100;
  let maxVal = 100;
  normBenchMap.forEach((v) => {
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  });
  fundKeys.forEach((k) => {
    normFundMaps[k].forEach((v) => {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    });
  });

  minVal = Math.floor(Math.max(0, minVal * 0.95));
  maxVal = Math.ceil(Math.max(minVal + 10, maxVal * 1.05));

  const width = 880;
  const height = 400;
  const padL = 55;
  const padR = 25;
  const padT = 25;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const nPoints = dates.length;
  const getX = (i: number) => padL + (i / Math.max(1, nPoints - 1)) * chartW;
  const getY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const buildPathFromMap = (valMap: Map<string, number>) => {
    let dStr = '';
    let started = false;
    dates.forEach((dt, idx) => {
      const val = valMap.get(dt);
      if (val !== undefined) {
        const x = getX(idx);
        const y = getY(val);
        dStr += `${started ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)} `;
        started = true;
      }
    });
    return dStr.trim();
  };

  const step = Math.round((maxVal - minVal) / 4);
  const yTicks = [minVal, minVal + step, minVal + 2 * step, minVal + 3 * step, maxVal];
  const activeIdx = hoverIndex !== null ? hoverIndex : nPoints - 1;
  const activeDate = dates[activeIdx];

  return (
    <div className="relative w-full space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {hasBench ? (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-amber-400 border-b border-dashed border-amber-400 inline-block" />
              <span className="text-amber-300 font-semibold">{benchName} (Benchmark)</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[11px]"
              title={benchReason || 'Benchmark unavailable'}
            >
              <span>Benchmark ({benchName}): Unavailable</span>
            </div>
          )}

          {fundKeys.map((k, idx) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="text-slate-200 font-medium">{k}</span>
            </div>
          ))}
        </div>

        {activeDate && (
          <div className="text-slate-300 font-mono text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
            <span>Date: {activeDate}</span>
            <span className="text-slate-600">|</span>
            {hasBench && (
              <span className="text-amber-400 font-semibold">
                Bench: {normBenchMap.get(activeDate)?.toFixed(1) ?? 'N/A'}
              </span>
            )}
            {fundKeys.map((k) => {
              const v = normFundMaps[k].get(activeDate);
              return (
                <span key={k} className="text-slate-300">
                  {k.split(' ')[0]}:{' '}
                  <span className="font-semibold text-white">
                    {v !== undefined ? v.toFixed(1) : '—'}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden bg-slate-950/80 border border-slate-800 rounded-xl p-3 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const idx = Math.min(nPoints - 1, Math.max(0, Math.round(relX * (nPoints - 1))));
            setHoverIndex(idx);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padL - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            y1={getY(100)}
            x2={width - padR}
            y2={getY(100)}
            stroke="#475569"
            strokeWidth="1.5"
          />

          {hasBench && (
            <path
              d={buildPathFromMap(normBenchMap)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="6 3"
            />
          )}

          {fundKeys.map((k, idx) => (
            <path
              key={k}
              d={buildPathFromMap(normFundMaps[k])}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ))}

          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padT}
              x2={getX(hoverIndex)}
              y2={height - padB}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          <text x={padL} y={height - 12} fill="#64748b" fontSize="11" fontFamily="monospace">
            {dates[0]}
          </text>
          <text
            x={width - padR}
            y={height - 12}
            textAnchor="end"
            fill="#64748b"
            fontSize="11"
            fontFamily="monospace"
          >
            {dates[dates.length - 1]}
          </text>
        </svg>
      </div>
    </div>
  );
};

/**
 * Rolling Return Distribution Box Plots
 */
interface RollingBoxPlotProps {
  distributions: { name: string; dist: RollingDistribution; color: string }[];
}

export const RollingBoxPlot: React.FC<RollingBoxPlotProps> = ({ distributions }) => {
  const validDistributions = distributions.filter(
    (d) =>
      d.dist.available &&
      d.dist.count > 0 &&
      d.dist.min !== null &&
      d.dist.max !== null &&
      d.dist.q25 !== null &&
      d.dist.q75 !== null &&
      d.dist.median !== null &&
      d.dist.mean !== null
  );

  if (!validDistributions.length) {
    return (
      <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
        Unavailable — No clean rolling return distributions available for the selected window.
      </div>
    );
  }

  let minVal = 0;
  let maxVal = 35;
  validDistributions.forEach((d) => {
    if (d.dist.min! < minVal) minVal = d.dist.min!;
    if (d.dist.max! > maxVal) maxVal = d.dist.max!;
  });

  minVal = Math.floor(minVal - 2);
  maxVal = Math.ceil(maxVal + 2);

  const width = 840;
  const height = 320;
  const padL = 50;
  const padR = 25;
  const padT = 25;
  const padB = 45;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const getY = (v: number) => padT + chartH - ((v - minVal) / Math.max(1, maxVal - minVal)) * chartH;
  const yTicks = [minVal, 0, 10, 20, maxVal].filter((v, i, a) => a.indexOf(v) === i);

  const slotW = chartW / validDistributions.length;
  const boxW = Math.min(54, slotW * 0.58);

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke={tick === 0 ? '#64748b' : '#1e293b'}
                strokeWidth={tick === 0 ? '1.5' : '1'}
                strokeDasharray={tick === 0 ? '' : '3 3'}
              />
              <text
                x={padL - 10}
                y={y + 3.5}
                textAnchor="end"
                fill="#64748b"
                fontSize="11"
                fontFamily="monospace"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {validDistributions.map((item, idx) => {
          const d = item.dist;
          const centerX = padL + idx * slotW + slotW / 2;
          const yMin = getY(d.min!);
          const yMax = getY(d.max!);
          const yQ25 = getY(d.q25!);
          const yQ75 = getY(d.q75!);
          const yMedian = getY(d.median!);
          const yMean = getY(d.mean!);

          return (
            <g key={item.name} className="group cursor-pointer">
              <line x1={centerX} y1={yMax} x2={centerX} y2={yMin} stroke={item.color} strokeWidth="1.6" opacity="0.8" />
              <line x1={centerX - boxW * 0.3} y1={yMax} x2={centerX + boxW * 0.3} y2={yMax} stroke={item.color} strokeWidth="1.6" />
              <line x1={centerX - boxW * 0.3} y1={yMin} x2={centerX + boxW * 0.3} y2={yMin} stroke={item.color} strokeWidth="1.6" />

              <rect
                x={centerX - boxW / 2}
                y={yQ75}
                width={boxW}
                height={Math.max(3, yQ25 - yQ75)}
                fill={item.color}
                fillOpacity="0.25"
                stroke={item.color}
                strokeWidth="2"
                rx="3"
              />

              <line x1={centerX - boxW / 2} y1={yMedian} x2={centerX + boxW / 2} y2={yMedian} stroke="#ffffff" strokeWidth="2.5" />
              <circle cx={centerX} cy={yMean} r="3.5" fill="#fbbf24" stroke="#000" strokeWidth="0.8" />

              <text x={centerX} y={height - 12} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="sans-serif" fontWeight="500">
                {item.name.length > 15 ? item.name.slice(0, 14) + '..' : item.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-6 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-white inline-block" />
          <span>Median Return</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span>Mean Return</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-2.5 bg-indigo-500/30 border border-indigo-500 rounded-xs inline-block" />
          <span>Interquartile Range (25th–75th Percentile)</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Upside vs. Downside Capture Ratio Quadrant Plot
 */
interface CaptureRatioProps {
  metrics: RiskMetrics[];
}

export const CaptureRatioQuadrant: React.FC<CaptureRatioProps> = ({ metrics }) => {
  const validMetrics = metrics.filter(
    (m) =>
      m.benchmarkRelativeAvailable &&
      m.upsideCapture !== null &&
      m.downsideCapture !== null
  );

  if (!validMetrics.length) {
    const reason =
      metrics.find((m) => m.unavailableReasons?.benchmark)?.unavailableReasons.benchmark ||
      'Unavailable: Independent verified benchmark series required to compute capture ratios.';
    return (
      <div className="p-8 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Capture Ratio Quadrant — Unavailable
        </div>
        <div className="text-xs text-slate-500 max-w-md mx-auto">{reason}</div>
      </div>
    );
  }

  const width = 640;
  const height = 320;
  const padL = 50;
  const padR = 30;
  const padT = 30;
  const padB = 45;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const minDown = 40;
  const maxDown = 130;
  const minUp = 60;
  const maxUp = 150;

  const getX = (down: number) => padL + ((down - minDown) / (maxDown - minDown)) * chartW;
  const getY = (up: number) => padT + chartH - ((up - minUp) / (maxUp - minUp)) * chartH;

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-sans">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        <line x1={padL} y1={getY(100)} x2={width - padR} y2={getY(100)} stroke="#475569" strokeWidth="1.2" strokeDasharray="4 4" />
        <line x1={getX(100)} y1={padT} x2={getX(100)} y2={height - padB} stroke="#475569" strokeWidth="1.2" strokeDasharray="4 4" />

        <text x={padL + 12} y={padT + 18} fill="#10b981" fontSize="10" fontWeight="700">
          ★ Ideal: High Upside (&gt;100%), Low Downside (&lt;100%)
        </text>
        <text x={width - padR - 10} y={height - padB - 12} textAnchor="end" fill="#f43f5e" fontSize="10" fontWeight="600">
          Vulnerable: Low Upside, High Downside
        </text>

        <circle cx={getX(100)} cy={getY(100)} r="4" fill="#f59e0b" />
        <text x={getX(100) + 6} y={getY(100) - 6} fill="#f59e0b" fontSize="10" fontWeight="600">
          Benchmark (100, 100)
        </text>

        {validMetrics.map((m) => {
          const up = m.upsideCapture!;
          const down = m.downsideCapture!;
          const cx = getX(down);
          const cy = getY(up);
          const isFavorable = up > 100 && down < 100;
          const color = isFavorable ? '#10b981' : up > down ? '#38bdf8' : '#fb923c';

          return (
            <g key={m.schemeCode} className="cursor-pointer group">
              <circle cx={cx} cy={cy} r="6" fill={color} fillOpacity="0.8" stroke="#ffffff" strokeWidth="1.5" />
              <text x={cx} y={cy - 10} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="600">
                {m.fundName.split(' ')[0]} ({up}% / {down}%)
              </text>
            </g>
          );
        })}

        <text x={padL + chartW / 2} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="monospace">
          Downside Capture Ratio (%) — Lower is Better
        </text>
        <text
          x={14}
          y={padT + chartH / 2}
          textAnchor="middle"
          fill="#64748b"
          fontSize="11"
          fontFamily="monospace"
          transform={`rotate(-90 14 ${padT + chartH / 2})`}
        >
          Upside Capture Ratio (%) — Higher is Better
        </text>
      </svg>
    </div>
  );
};

/**
 * Return Correlation Heatmap & Diversification Score (Null-safe)
 */
interface CorrelationHeatmapProps {
  available: boolean;
  reason?: string | null;
  names: string[];
  matrix: (number | null)[][] | null;
  diversificationScore: number | null;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  available,
  reason,
  names,
  matrix,
  diversificationScore,
}) => {
  if (!available || !names.length || !matrix?.length) {
    return (
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-1.5 font-sans">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Daily Return Correlation Matrix — Unavailable
        </h3>
        <p className="text-xs text-slate-500">
          {reason || 'Unavailable: At least 2 validated non-quarantined schemes with sufficient overlapping sessions are required.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Daily Return Correlation Matrix</h3>
          <p className="text-xs text-slate-400">
            Pairwise Pearson return correlation coefficient (r). Values closer to 0 denote stronger diversification.
          </p>
        </div>
        <div className="p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-right">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Diversification Score</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
            {diversificationScore !== null ? `${diversificationScore}/100` : 'Unavailable'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse table-fixed w-full text-center font-mono text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left font-sans text-slate-400 font-semibold w-40">Scheme</th>
              {names.map((name, i) => (
                <th key={i} className="p-2 text-slate-300 font-medium truncate max-w-[120px]">
                  {name.length > 15 ? name.slice(0, 14) + '..' : name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rowName, r) => (
              <tr key={r}>
                <td className="p-2.5 text-left font-sans text-slate-300 font-medium truncate max-w-[160px] border-t border-slate-800">
                  {rowName}
                </td>
                {matrix[r].map((val, c) => {
                  const isDiag = r === c;
                  const bgStyle =
                    val === null
                      ? 'bg-slate-900 text-slate-500'
                      : isDiag
                      ? 'bg-slate-800 text-slate-400'
                      : val < 0.3
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-bold'
                      : val < 0.65
                      ? 'bg-sky-950/60 text-sky-300 border border-sky-800/50'
                      : 'bg-rose-950/50 text-rose-300 border border-rose-800/40';

                  return (
                    <td key={c} className={`p-2.5 border-t border-slate-800 transition-colors ${bgStyle}`}>
                      <span>{val !== null ? val.toFixed(2) : 'Unavailable'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * SIP Wealth Growth Line Chart (Null-safe)
 */
interface SipChartProps {
  simulation: SipSimulationResult;
  fundName: string;
}

export const SipGrowthChart: React.FC<SipChartProps> = ({ simulation }) => {
  const { available, reason, timeline, totalInvested, totalCorpus, xirrPct } = simulation;
  if (!available || !timeline.length || totalCorpus === null || totalInvested === null) {
    return (
      <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          SIP Wealth Chart — Unavailable
        </div>
        <div className="text-xs text-slate-500">
          {reason || 'Unavailable: Validated scheme NAV history required to simulate SIP cash flows.'}
        </div>
      </div>
    );
  }

  const width = 800;
  const height = 300;
  const padL = 60;
  const padR = 25;
  const padT = 20;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(totalCorpus, totalInvested, 1) * 1.1;
  const getX = (i: number) => padL + (i / Math.max(1, timeline.length - 1)) * chartW;
  const getY = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const investedPath = timeline
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)},${getY(p.invested).toFixed(1)}`)
    .join(' ');

  const corpusPath = timeline
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)},${getY(p.corpus).toFixed(1)}`)
    .join(' ');

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Systematic Investment Plan (SIP) Wealth Accumulation</h3>
          <p className="text-xs text-slate-400">Monthly SIP of ₹{simulation.monthlyAmount.toLocaleString()} over selected window</p>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div>
            <div className="text-slate-400">Invested:</div>
            <div className="font-bold text-slate-200">₹{totalInvested.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Final Corpus:</div>
            <div className="font-bold text-emerald-400 text-sm">₹{totalCorpus.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Annualized XIRR:</div>
            <div className="font-bold text-indigo-400 text-sm">
              {xirrPct !== null ? `${xirrPct}%` : 'Unavailable'}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden bg-slate-950 border border-slate-850 rounded-xl p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="#334155" strokeWidth="1" />
          <path d={investedPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
          <path d={corpusPath} fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" />
          <text x={padL} y={height - 12} fill="#64748b" fontSize="11" fontFamily="monospace">
            {timeline[0]?.date}
          </text>
          <text x={width - padR} y={height - 12} textAnchor="end" fill="#64748b" fontSize="11" fontFamily="monospace">
            {timeline[timeline.length - 1]?.date}
          </text>
        </svg>
      </div>
    </div>
  );
};

export { BubbleScatterPlot, OverlapHeatmap } from './QuantVisualsFallback';
