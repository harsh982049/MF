import React, { useState } from 'react';
import { RollingDistribution, RiskMetrics, SipSimulationResult } from '../types/quant';

/**
 * Rebased Cumulative Performance Line Chart (Base = 100)
 * Expanded Viewport (Height 420px) with Responsive Grid and Multi-Fund Tracking
 */
interface PerformanceChartProps {
  seriesMap: Record<string, { date: string; nav: number }[]>;
  benchSeries: { date: string; nav: number }[];
  benchName: string;
  colors: string[];
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  seriesMap,
  benchSeries,
  benchName,
  colors,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const fundKeys = Object.keys(seriesMap);
  if (fundKeys.length === 0 || !benchSeries.length) {
    return <div className="p-8 text-center text-slate-500">No performance series available</div>;
  }

  const normBench = benchSeries.map((p) => ({
    date: p.date,
    val: (p.nav / benchSeries[0].nav) * 100,
  }));

  const normFunds: Record<string, { date: string; val: number }[]> = {};
  fundKeys.forEach((k) => {
    const s = seriesMap[k];
    if (s && s.length > 0) {
      const base = s[0].nav;
      normFunds[k] = s.map((p) => ({
        date: p.date,
        val: (p.nav / base) * 100,
      }));
    }
  });

  let minVal = 100;
  let maxVal = 100;
  normBench.forEach((p) => {
    if (p.val < minVal) minVal = p.val;
    if (p.val > maxVal) maxVal = p.val;
  });
  fundKeys.forEach((k) => {
    normFunds[k]?.forEach((p) => {
      if (p.val < minVal) minVal = p.val;
      if (p.val > maxVal) maxVal = p.val;
    });
  });

  minVal = Math.floor(Math.max(0, minVal * 0.95));
  maxVal = Math.ceil(maxVal * 1.05);

  const width = 880;
  const height = 400; // Expanded height to eliminate cramped view
  const padL = 55;
  const padR = 25;
  const padT = 25;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const nPoints = normBench.length;
  const getX = (i: number) => padL + (i / Math.max(1, nPoints - 1)) * chartW;
  const getY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const buildPath = (data: { val: number }[]) => {
    if (!data.length) return '';
    return data
      .map((p, idx) => {
        const x = getX(idx);
        const y = getY(p.val);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const step = Math.round((maxVal - minVal) / 4);
  const yTicks = [minVal, minVal + step, minVal + 2 * step, minVal + 3 * step, maxVal];
  const activeIdx = hoverIndex !== null ? hoverIndex : nPoints - 1;

  return (
    <div className="relative w-full space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 border-b border-dashed border-amber-400 inline-block" />
            <span className="text-amber-300 font-semibold">{benchName} (Benchmark)</span>
          </div>
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

        {activeIdx < nPoints && (
          <div className="text-slate-300 font-mono text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm flex items-center gap-3">
            <span>Date: {normBench[activeIdx]?.date}</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-semibold">Bench: {normBench[activeIdx]?.val.toFixed(1)}</span>
            {fundKeys.map((k) => (
              <span key={k} className="text-slate-300">
                {k.split(' ')[0]}: <span className="font-semibold text-white">{normFunds[k]?.[activeIdx]?.val.toFixed(1)}</span>
              </span>
            ))}
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
          {/* Y Axis Gridlines */}
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

          {/* Base 100 Guideline */}
          <line
            x1={padL}
            y1={getY(100)}
            x2={width - padR}
            y2={getY(100)}
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* Benchmark trace */}
          <path
            d={buildPath(normBench)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeDasharray="6 3"
          />

          {/* Fund traces */}
          {fundKeys.map((k, idx) => (
            <path
              key={k}
              d={buildPath(normFunds[k] || [])}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ))}

          {/* Hover Crosshair */}
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

          {/* X Axis dates */}
          <text x={padL} y={height - 12} fill="#64748b" fontSize="11" fontFamily="monospace">
            {normBench[0]?.date}
          </text>
          <text
            x={width - padR}
            y={height - 12}
            textAnchor="end"
            fill="#64748b"
            fontSize="11"
            fontFamily="monospace"
          >
            {normBench[normBench.length - 1]?.date}
          </text>
        </svg>
      </div>
    </div>
  );
};

/**
 * 3Y/5Y Rolling Return Distribution Box Plots
 */
interface RollingBoxPlotProps {
  distributions: { name: string; dist: RollingDistribution; color: string }[];
}

export const RollingBoxPlot: React.FC<RollingBoxPlotProps> = ({ distributions }) => {
  if (!distributions.length) {
    return <div className="p-6 text-center text-slate-500">No rolling return series available</div>;
  }

  let minVal = 0;
  let maxVal = 35;
  distributions.forEach((d) => {
    if (d.dist.min < minVal) minVal = d.dist.min;
    if (d.dist.max > maxVal) maxVal = d.dist.max;
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

  const getY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  const yTicks = [minVal, 0, 10, 20, maxVal].filter((v, i, a) => a.indexOf(v) === i);

  const slotW = chartW / distributions.length;
  const boxW = Math.min(54, slotW * 0.58);

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        {/* Y-axis Grid */}
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

        {/* Box Plots */}
        {distributions.map((item, idx) => {
          const d = item.dist;
          const centerX = padL + idx * slotW + slotW / 2;
          const yMin = getY(d.min);
          const yMax = getY(d.max);
          const yQ25 = getY(d.q25);
          const yQ75 = getY(d.q75);
          const yMedian = getY(d.median);
          const yMean = getY(d.mean);

          return (
            <g key={item.name} className="group cursor-pointer">
              {/* Whiskers */}
              <line
                x1={centerX}
                y1={yMax}
                x2={centerX}
                y2={yMin}
                stroke={item.color}
                strokeWidth="1.6"
                opacity="0.8"
              />
              <line
                x1={centerX - boxW * 0.3}
                y1={yMax}
                x2={centerX + boxW * 0.3}
                y2={yMax}
                stroke={item.color}
                strokeWidth="1.6"
              />
              <line
                x1={centerX - boxW * 0.3}
                y1={yMin}
                x2={centerX + boxW * 0.3}
                y2={yMin}
                stroke={item.color}
                strokeWidth="1.6"
              />

              {/* IQR Box */}
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

              {/* Median Line */}
              <line
                x1={centerX - boxW / 2}
                y1={yMedian}
                x2={centerX + boxW / 2}
                y2={yMedian}
                stroke="#ffffff"
                strokeWidth="2.5"
              />

              {/* Mean marker */}
              <circle cx={centerX} cy={yMean} r="3.5" fill="#fbbf24" stroke="#000" strokeWidth="0.8" />

              {/* Label */}
              <text
                x={centerX}
                y={height - 12}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="sans-serif"
                fontWeight="500"
              >
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
  if (!metrics.length) return null;

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
        {/* 100% Benchmark Crosshairs */}
        <line
          x1={padL}
          y1={getY(100)}
          x2={width - padR}
          y2={getY(100)}
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <line
          x1={getX(100)}
          y1={padT}
          x2={getX(100)}
          y2={height - padB}
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        {/* Quadrant Highlights */}
        <text x={padL + 12} y={padT + 18} fill="#10b981" fontSize="10" fontWeight="700">
          ★ Ideal: High Upside (&gt;100%), Low Downside (&lt;100%)
        </text>
        <text x={width - padR - 10} y={height - padB - 12} textAnchor="end" fill="#f43f5e" fontSize="10" fontWeight="600">
          Vulnerable: Low Upside, High Downside
        </text>

        {/* Benchmark anchor */}
        <circle cx={getX(100)} cy={getY(100)} r="4" fill="#f59e0b" />
        <text x={getX(100) + 6} y={getY(100) - 6} fill="#f59e0b" fontSize="10" fontWeight="600">
          Benchmark (100, 100)
        </text>

        {/* Fund Points */}
        {metrics.map((m) => {
          const cx = getX(m.downsideCapture);
          const cy = getY(m.upsideCapture);
          const isFavorable = m.upsideCapture > 100 && m.downsideCapture < 100;
          const color = isFavorable ? '#10b981' : m.upsideCapture > m.downsideCapture ? '#38bdf8' : '#fb923c';

          return (
            <g key={m.schemeCode} className="cursor-pointer group">
              <circle cx={cx} cy={cy} r="6" fill={color} fillOpacity="0.8" stroke="#ffffff" strokeWidth="1.5" />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="600"
              >
                {m.fundName.split(' ')[0]} ({m.upsideCapture}% / {m.downsideCapture}%)
              </text>
            </g>
          );
        })}

        {/* Axis Labels */}
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
      <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-2">
        <span>Firms in top-left capture more bull market gains while shielding capital during market corrections.</span>
      </div>
    </div>
  );
};

/**
 * Return Correlation Heatmap & Diversification Score
 */
interface CorrelationHeatmapProps {
  names: string[];
  matrix: number[][];
  diversificationScore: number;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  names,
  matrix,
  diversificationScore,
}) => {
  if (!names.length || !matrix.length) return null;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Daily Return Correlation Matrix</h3>
          <p className="text-xs text-slate-400">
            Pairwise Pearson return correlation coefficient ($r$). Values close to 0 denote strong diversification.
          </p>
        </div>
        <div className="p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-right">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Diversification Score</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
            {diversificationScore}/100
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
                  const bgStyle = isDiag
                    ? 'bg-slate-800 text-slate-400'
                    : val < 0.3
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-bold'
                    : val < 0.65
                    ? 'bg-sky-950/60 text-sky-300 border border-sky-800/50'
                    : 'bg-rose-950/50 text-rose-300 border border-rose-800/40';

                  return (
                    <td key={c} className={`p-2.5 border-t border-slate-800 transition-colors ${bgStyle}`}>
                      <span>{val.toFixed(2)}</span>
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
 * SIP Wealth Growth Line Chart
 */
interface SipChartProps {
  simulation: SipSimulationResult;
  fundName: string;
}

export const SipGrowthChart: React.FC<SipChartProps> = ({ simulation, fundName }) => {
  const { timeline, totalInvested, totalCorpus, xirrPct } = simulation;
  if (!timeline.length) return null;

  const width = 800;
  const height = 300;
  const padL = 60;
  const padR = 25;
  const padT = 20;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(totalCorpus, totalInvested) * 1.1;
  const getX = (i: number) => padL + (i / (timeline.length - 1)) * chartW;
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
          <p className="text-xs text-slate-400">Monthly SIP of ₹{simulation.monthlyAmount.toLocaleString()} over historical period</p>
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
            <div className="font-bold text-indigo-400 text-sm">{xirrPct}%</div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden bg-slate-950 border border-slate-850 rounded-xl p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="#334155" strokeWidth="1" />

          {/* Invested capital (gray line) */}
          <path d={investedPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />

          {/* Accumulated corpus (emerald line) */}
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
