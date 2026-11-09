import React, { useState } from 'react';
import { RiskMetrics } from '../types/quant';

/**
 * Beta vs Jensen's Alpha Bubble Scatter Plot
 */
interface BubbleScatterProps {
  metrics: RiskMetrics[];
}

export const BubbleScatterPlot: React.FC<BubbleScatterProps> = ({ metrics }) => {
  if (!metrics.length) return null;

  const width = 640;
  const height = 320;
  const padL = 50;
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
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-sans">
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

        <text x={getX(1.0) + 4} y={getY(0) - 4} fill="#64748b" fontSize="10" fontFamily="monospace">
          Benchmark (β=1.0, α=0%)
        </text>

        {metrics.map((m) => {
          const cx = getX(m.beta);
          const cy = getY(m.jensensAlpha);
          const radius = Math.max(8, Math.min(26, Math.abs(m.informationRatio) * 14 + 6));
          const color = m.sharpe > 1.2 ? '#10b981' : m.sharpe > 0.8 ? '#38bdf8' : '#f59e0b';

          return (
            <g key={m.schemeCode} className="cursor-pointer group">
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                fillOpacity="0.45"
                stroke={color}
                strokeWidth="2.2"
              />
              <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
              <text
                x={cx}
                y={cy - radius - 4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="600"
              >
                {m.fundName.split(' ')[0]} (IR: {m.informationRatio})
              </text>
            </g>
          );
        })}

        <text
          x={padL + chartW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#64748b"
          fontSize="11"
          fontFamily="monospace"
        >
          Portfolio Beta (β)
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
          Jensen&apos;s Alpha (%)
        </text>
      </svg>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400 px-2">
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

  return (
    <div className="overflow-x-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-sans">
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
                <td className="p-2.5 text-left font-sans text-slate-300 font-medium truncate max-w-[160px] border-t border-slate-800">
                  {rowName}
                </td>
                {matrix[r].map((val, c) => {
                  const isDiag = r === c;
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

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/70">
        <div>
          <span>Color legend: </span>
          <span className="text-emerald-400 font-medium mr-3">&lt; 25% Low Overlap (High Diversification)</span>
          <span className="text-amber-400 font-medium mr-3">25%–40% Moderate Overlap</span>
          <span className="text-rose-400 font-medium">&gt; 40% Heavy Redundancy</span>
        </div>
        {hoveredCell && hoveredCell.r !== hoveredCell.c && (
          <div className="text-slate-200">
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
