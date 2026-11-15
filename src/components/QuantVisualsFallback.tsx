import React, { useState } from 'react';
import { RiskMetrics } from '../types/quant';

/**
 * Beta vs Jensen's Alpha Bubble Scatter Plot
 */
interface BubbleScatterProps {
  metrics: RiskMetrics[];
}

export const BubbleScatterPlot: React.FC<BubbleScatterProps> = ({ metrics }) => {
  const validMetrics = metrics.filter(
    (m) =>
      m.benchmarkRelativeAvailable &&
      m.beta !== null &&
      m.jensensAlpha !== null
  );

  if (!validMetrics.length) {
    const reason =
      metrics.find((m) => m.unavailableReasons?.benchmark)?.unavailableReasons.benchmark ||
      'Unavailable: Independent verified benchmark series required to compute Beta and Jensen’s Alpha.';
    return (
      <div className="p-8 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Beta vs. Jensen&apos;s Alpha — Unavailable
        </div>
        <div className="text-xs text-slate-500 max-w-md mx-auto">{reason}</div>
      </div>
    );
  }

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

  validMetrics.forEach((m) => {
    const b = m.beta!;
    const a = m.jensensAlpha!;
    if (b < minBeta) minBeta = Math.floor(b * 10) / 10;
    if (b > maxBeta) maxBeta = Math.ceil(b * 10) / 10;
    if (a < minAlpha) minAlpha = Math.floor(a);
    if (a > maxAlpha) maxAlpha = Math.ceil(a);
  });

  const getX = (b: number) => padL + ((b - minBeta) / Math.max(0.1, maxBeta - minBeta)) * chartW;
  const getY = (a: number) => padT + chartH - ((a - minAlpha) / Math.max(0.1, maxAlpha - minAlpha)) * chartH;

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-sans">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        <line
          x1={padL}
          y1={getY(0)}
          x2={width - padR}
          y2={getY(0)}
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
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

        {validMetrics.map((m) => {
          const cx = getX(m.beta!);
          const cy = getY(m.jensensAlpha!);
          const irVal = m.informationRatio ?? 0;
          const radius = Math.max(8, Math.min(26, Math.abs(irVal) * 14 + 6));
          const sharpeVal = m.sharpe ?? 0;
          const color = sharpeVal > 1.2 ? '#10b981' : sharpeVal > 0.8 ? '#38bdf8' : '#f59e0b';

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
                {m.fundName.split(' ')[0]} (IR: {m.informationRatio ?? 'Unavailable'})
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
 * Dynamic Pairwise ISIN Overlap Heatmap (Coverage-aware; preserves genuine 0.0% ONLY for >=95% complete disclosures)
 */
interface OverlapHeatmapProps {
  available: boolean;
  exactAvailable?: boolean;
  reason?: string | null;
  names: string[];
  matrix: (number | null)[][];
  observedSubsetMatrix?: (number | null)[][];
  coveragePctByFund?: (number | null)[];
  unknownPctByFund?: (number | null)[];
  coverageStatusByFund?: ('complete' | 'partial' | 'unavailable')[];
}

export const OverlapHeatmap: React.FC<OverlapHeatmapProps> = ({
  available,
  exactAvailable = true,
  reason,
  names,
  matrix,
  observedSubsetMatrix,
  coveragePctByFund,
  unknownPctByFund,
  coverageStatusByFund,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  if (!available || !names.length || !matrix.length) {
    return (
      <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          ISIN Overlap Matrix — Unavailable
        </div>
        <div className="text-xs text-slate-500">
          {reason || 'Unavailable: Verified non-cash security holdings are required for overlap analysis.'}
        </div>
      </div>
    );
  }

  const hasPartialFunds = Boolean(coverageStatusByFund?.some((s) => s === 'partial'));

  return (
    <div className="space-y-4 font-sans">
      {!exactAvailable && reason && (
        <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800/70 text-xs text-amber-200 leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-300 block mb-0.5">
            Partial Holdings Coverage — Exact Overlap Suppressed
          </span>
          {reason}
        </div>
      )}

      <div className="overflow-x-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4">
        <div className="inline-block min-w-full">
          <table className="border-collapse table-fixed w-full text-center font-mono text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left font-sans text-slate-400 font-semibold w-44">
                  Scheme
                </th>
                {names.map((name, i) => {
                  const cov = coveragePctByFund?.[i];
                  return (
                    <th key={i} className="p-2 text-slate-300 font-medium truncate max-w-[130px]">
                      <div>{name.length > 15 ? name.slice(0, 14) + '..' : name}</div>
                      {cov !== null && cov !== undefined && (
                        <div className="text-[10px] text-slate-500 font-normal">
                          Cov: {cov.toFixed(1)}%
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {names.map((rowName, r) => {
                const covR = coveragePctByFund?.[r];
                const unkR = unknownPctByFund?.[r];
                const statR = coverageStatusByFund?.[r];
                return (
                  <tr key={r}>
                    <td className="p-2.5 text-left font-sans text-slate-300 font-medium border-t border-slate-800">
                      <div className="truncate max-w-[165px]">{rowName}</div>
                      {covR !== null && covR !== undefined && (
                        <div className="text-[10px] font-mono text-slate-500">
                          {statR === 'partial'
                            ? `${covR.toFixed(1)}% disclosed · ${unkR?.toFixed(1)}% unknown`
                            : `${covR.toFixed(1)}% disclosed`}
                        </div>
                      )}
                    </td>
                    {matrix[r].map((val, c) => {
                      const isDiag = r === c;
                      const statC = coverageStatusByFund?.[c];
                      const isPartialPair = statR === 'partial' || statC === 'partial';
                      const subsetVal = observedSubsetMatrix?.[r]?.[c];

                      const bgStyle =
                        val === null
                          ? 'bg-slate-900/80 text-slate-400'
                          : isDiag
                          ? 'bg-slate-800 text-slate-300'
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
                          {val !== null ? (
                            <span>{val.toFixed(1)}%</span>
                          ) : isPartialPair && !isDiag && subsetVal !== null && subsetVal !== undefined ? (
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-amber-300 font-semibold">Unavailable</div>
                              <div className="text-[9px] text-slate-500">
                                Subset only: {subsetVal.toFixed(1)}%
                              </div>
                            </div>
                          ) : isPartialPair && isDiag && covR !== null && covR !== undefined ? (
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-slate-400">Partial</div>
                              <div className="text-[9px] text-slate-500">{covR.toFixed(1)}% cov</div>
                            </div>
                          ) : (
                            <span>Unavailable</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/70 gap-2">
          <div>
            <span>Color legend (exact ≥95% coverage only): </span>
            <span className="text-emerald-400 font-medium mr-3">&lt; 25% Low Overlap</span>
            <span className="text-amber-400 font-medium mr-3">25%–40% Moderate</span>
            <span className="text-rose-400 font-medium">&gt; 40% Heavy Redundancy</span>
          </div>
          {hoveredCell && hoveredCell.r !== hoveredCell.c && (
            <div className="text-slate-200">
              <span className="font-semibold">{names[hoveredCell.r].split(' ')[0]}</span> &amp;{' '}
              <span className="font-semibold">{names[hoveredCell.c].split(' ')[0]}</span>:{' '}
              <span className="font-mono font-bold text-amber-300">
                {matrix[hoveredCell.r][hoveredCell.c] !== null
                  ? `${matrix[hoveredCell.r][hoveredCell.c]!.toFixed(1)}% (Exact)`
                  : observedSubsetMatrix?.[hoveredCell.r]?.[hoveredCell.c] !== null &&
                    observedSubsetMatrix?.[hoveredCell.r]?.[hoveredCell.c] !== undefined
                  ? `Exact Unavailable (Observed subset: ${observedSubsetMatrix[hoveredCell.r][hoveredCell.c]!.toFixed(1)}%)`
                  : 'Unavailable'}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasPartialFunds && (
        <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex flex-wrap gap-3">
          <span className="font-semibold text-amber-300">Disclosed Coverage vs Unknown Portfolio:</span>
          {names.map((nm, idx) =>
            coveragePctByFund?.[idx] !== null && coveragePctByFund?.[idx] !== undefined ? (
              <span key={idx} className="font-mono">
                {nm.split(' ').slice(0, 2).join(' ')}: {coveragePctByFund[idx]!.toFixed(2)}% disclosed /{' '}
                {(unknownPctByFund?.[idx] ?? 0).toFixed(2)}% unknown
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );
};

