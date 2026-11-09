import React, { useState } from 'react';
import { RollingDistribution, RiskMetrics } from '../types/quant';

/**
 * Rebased Cumulative Performance Line Chart (Base = 100)
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

  // Base normalization (first point = 100)
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

  // Calculate min & max for Y-axis
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

  const width = 800;
  const height = 320;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 35;

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

  const yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];
  const activeIdx = hoverIndex !== null ? hoverIndex : nPoints - 1;

  return (
    <div className="relative w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-amber-400 border-b border-dashed border-amber-400 inline-block" />
            <span className="text-amber-300 font-medium">{benchName} (Benchmark)</span>
          </div>
          {fundKeys.map((k, idx) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="text-slate-300 font-medium">{k}</span>
            </div>
          ))}
        </div>

        {activeIdx < nPoints && (
          <div className="text-slate-400 font-mono text-[11px] bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
            <span>Date: {normBench[activeIdx]?.date}</span>
            <span className="mx-2 text-slate-600">|</span>
            <span className="text-amber-400">Bench: {normBench[activeIdx]?.val.toFixed(1)}</span>
            {fundKeys.map((k) => (
              <span key={k} className="ml-2 text-slate-300">
                {k.split(' ')[0]}: {normFunds[k]?.[activeIdx]?.val.toFixed(1)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden bg-slate-950/80 border border-slate-800/80 rounded-xl p-2">
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
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Base 100 line */}
          <line
            x1={padL}
            y1={getY(100)}
            x2={width - padR}
            y2={getY(100)}
            stroke="#334155"
            strokeWidth="1.2"
          />

          {/* Benchmark trace */}
          <path
            d={buildPath(normBench)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="5 3"
          />

          {/* Fund traces */}
          {fundKeys.map((k, idx) => (
            <path
              key={k}
              d={buildPath(normFunds[k] || [])}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="2.2"
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

          {/* X Axis labels */}
          <text x={padL} y={height - 10} fill="#64748b" fontSize="10" fontFamily="monospace">
            {normBench[0]?.date}
          </text>
          <text
            x={width - padR}
            y={height - 10}
            textAnchor="end"
            fill="#64748b"
            fontSize="10"
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

  // Find min and max for box plot scale
  let minVal = 0;
  let maxVal = 30;
  distributions.forEach((d) => {
    if (d.dist.min < minVal) minVal = d.dist.min;
    if (d.dist.max > maxVal) maxVal = d.dist.max;
  });

  minVal = Math.floor(minVal - 2);
  maxVal = Math.ceil(maxVal + 2);

  const width = 760;
  const height = 280;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const getY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  const yTicks = [minVal, 0, Math.round((minVal + maxVal) / 2), maxVal].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  const slotW = chartW / distributions.length;
  const boxW = Math.min(48, slotW * 0.55);

  return (
    <div className="w-full overflow-hidden bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
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
                stroke={tick === 0 ? '#475569' : '#1e293b'}
                strokeWidth={tick === 0 ? '1.5' : '1'}
                strokeDasharray={tick === 0 ? '' : '3 3'}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="10"
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
              {/* Whiskers line */}
              <line
                x1={centerX}
                y1={yMax}
                x2={centerX}
                y2={yMin}
                stroke={item.color}
                strokeWidth="1.5"
                opacity="0.7"
              />
              {/* Whisker caps */}
              <line
                x1={centerX - boxW * 0.3}
                y1={yMax}
                x2={centerX + boxW * 0.3}
                y2={yMax}
                stroke={item.color}
                strokeWidth="1.5"
              />
              <line
                x1={centerX - boxW * 0.3}
                y1={yMin}
                x2={centerX + boxW * 0.3}
                y2={yMin}
                stroke={item.color}
                strokeWidth="1.5"
              />

              {/* IQR Box (Q25 to Q75) */}
              <rect
                x={centerX - boxW / 2}
                y={yQ75}
                width={boxW}
                height={Math.max(2, yQ25 - yQ75)}
                fill={item.color}
                fillOpacity="0.25"
                stroke={item.color}
                strokeWidth="1.8"
                rx="3"
              />

              {/* Median Line */}
              <line
                x1={centerX - boxW / 2}
                y1={yMedian}
                x2={centerX + boxW / 2}
                y2={yMedian}
                stroke="#ffffff"
                strokeWidth="2.2"
              />

              {/* Mean Diamond */}
              <circle cx={centerX} cy={yMean} r="3" fill="#fbbf24" stroke="#000" strokeWidth="0.8" />

              {/* Label */}
              <text
                x={centerX}
                y={height - 12}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="sans-serif"
              >
                {item.name.length > 14 ? item.name.slice(0, 13) + '..' : item.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-6 mt-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-white inline-block" />
          <span>Median</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span>Mean</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 bg-indigo-500/30 border border-indigo-500 rounded-xs inline-block" />
          <span>25th–75th Percentile IQR</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Beta vs Jensen's Alpha Bubble Scatter Plot
 */
interface BubbleScatterProps {
  metrics: RiskMetrics[];
}

export const BubbleScatterPlot: React.FC<BubbleScatterProps> = ({ metrics }) => {
  if (!metrics.length) return null;

  const width = 640;
  const height = 300;
  const padL = 45;
  const padR = 25;
  const padT = 25;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  let minBeta = 0.5;
  let maxBeta = 1.4;
  let minAlpha = -4;
  let maxAlpha = 8;

  metrics.forEach((m) => {
    if (m.beta < minBeta) minBeta = Math.floor(m.beta * 10) / 10;
    if (m.beta > maxBeta) maxBeta = Math.ceil(m.beta * 10) / 10;
    if (m.jensensAlpha < minAlpha) minAlpha = Math.floor(m.jensensAlpha);
    if (m.jensensAlpha > maxAlpha) maxAlpha = Math.ceil(m.jensensAlpha);
  });

  const getX = (b: number) => padL + ((b - minBeta) / (maxBeta - minBeta)) * chartW;
  const getY = (a: number) => padT + chartH - ((a - minAlpha) / (maxAlpha - minAlpha)) * chartH;

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        {/* Zero Alpha Line */}
        <line
          x1={padL}
          y1={getY(0)}
          x2={width - padR}
          y2={getY(0)}
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        {/* Unit Beta Line */}
        <line
          x1={getX(1.0)}
          y1={padT}
          x2={getX(1.0)}
          y2={height - padB}
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        {/* Labels for benchmark anchor */}
        <text x={getX(1.0) + 4} y={getY(0) - 4} fill="#64748b" fontSize="9" fontFamily="monospace">
          Benchmark (β=1.0, α=0%)
        </text>

        {/* Quadrant text */}
        <text x={width - padR - 8} y={padT + 14} textAnchor="end" fill="#10b981" fontSize="9" fontWeight="600">
          Aggressive Alpha (β &gt; 1, α &gt; 0)
        </text>
        <text x={padL + 8} y={padT + 14} textAnchor="start" fill="#38bdf8" fontSize="9" fontWeight="600">
          Defensive Alpha (β &lt; 1, α &gt; 0)
        </text>

        {/* Bubbles */}
        {metrics.map((m) => {
          const cx = getX(m.beta);
          const cy = getY(m.jensensAlpha);
          const radius = Math.max(7, Math.min(24, Math.abs(m.informationRatio) * 14 + 6));
          const color = m.sharpe > 1.2 ? '#10b981' : m.sharpe > 0.8 ? '#38bdf8' : '#f59e0b';

          return (
            <g key={m.schemeCode} className="cursor-pointer group">
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                fillOpacity="0.4"
                stroke={color}
                strokeWidth="2"
              />
              <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
              <text
                x={cx}
                y={cy - radius - 3}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="10"
                fontWeight="600"
                fontFamily="sans-serif"
              >
                {m.fundName.split(' ')[0]} (IR: {m.informationRatio})
              </text>
            </g>
          );
        })}

        {/* Axis Titles */}
        <text
          x={padL + chartW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="monospace"
        >
          Portfolio Beta (β)
        </text>
        <text
          x={14}
          y={padT + chartH / 2}
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="monospace"
          transform={`rotate(-90 14 ${padT + chartH / 2})`}
        >
          Jensen&apos;s Alpha (%)
        </text>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 px-2">
        <span>Bubble Size: Information Ratio</span>
        <span>Color: Sharpe Ratio (Green &gt; 1.2 · Blue 0.8–1.2 · Amber &lt; 0.8)</span>
      </div>
    </div>
  );
};

/**
 * Dynamic Pairwise ISIN Overlap Heatmap
 */
interface OverlapHeatmapProps {
  names: string[];
  matrix: number[][];
}

export const OverlapHeatmap: React.FC<OverlapHeatmapProps> = ({ names, matrix }) => {
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  if (!names.length || !matrix.length) return null;

  const n = names.length;

  return (
    <div className="overflow-x-auto bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
      <div className="inline-block min-w-full">
        <table className="border-collapse table-fixed w-full text-center font-mono text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left font-sans text-slate-400 font-semibold w-40">
                Scheme
              </th>
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
                <td className="p-2 text-left font-sans text-slate-300 font-medium truncate max-w-[160px] border-t border-slate-800">
                  {rowName}
                </td>
                {matrix[r].map((val, c) => {
                  const isDiag = r === c;
                  // Color intensity based on overlap %
                  const intensity = isDiag ? 100 : Math.min(100, Math.max(0, val * 2.2));
                  const bgStyle = isDiag
                    ? 'bg-slate-800 text-slate-400'
                    : val > 40
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-900/60 font-semibold'
                    : val > 25
                    ? 'bg-amber-950/50 text-amber-300 border border-amber-900/50'
                    : 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40';

                  return (
                    <td
                      key={c}
                      className={`p-2.5 border-t border-slate-800 transition-colors ${bgStyle}`}
                      onMouseEnter={() => setHoveredCell({ r, c })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <span>{val.toFixed(1)}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/70">
        <div>
          <span>Color legend: </span>
          <span className="text-emerald-400 font-medium mr-3">&lt; 25% Low Overlap (High Diversification)</span>
          <span className="text-amber-400 font-medium mr-3">25%–40% Moderate Overlap</span>
          <span className="text-rose-400 font-medium">&gt; 40% Heavy Redundancy</span>
        </div>
        {hoveredCell && hoveredCell.r !== hoveredCell.c && (
          <div className="text-slate-200 font-sans">
            <span className="font-semibold">{names[hoveredCell.r].split(' ')[0]}</span> &amp;{' '}
            <span className="font-semibold">{names[hoveredCell.c].split(' ')[0]}</span>: Overlap{' '}
            <span className="font-mono font-bold text-amber-300">
              {matrix[hoveredCell.r][hoveredCell.c].toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
