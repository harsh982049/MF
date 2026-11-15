import { BenchmarkStatus, NavPoint } from '../types/quant';
import { validateRawNavSeries } from '../utils/navValidator';

export interface BenchmarkDefinition {
  symbol: string;
  name: string;
  variant: 'TRI' | 'PRI' | 'Index';
  assetClass: 'Equity' | 'Debt' | 'Commodity' | 'International';
}

export const BENCHMARKS: BenchmarkDefinition[] = [
  {
    symbol: '^CRSLDX',
    name: 'Nifty 500 Total Returns Index (TRI)',
    variant: 'TRI',
    assetClass: 'Equity',
  },
  {
    symbol: '^NSEI',
    name: 'Nifty 50 Total Returns Index (TRI)',
    variant: 'TRI',
    assetClass: 'Equity',
  },
  {
    symbol: 'NIFTYMIDCAP150.NS',
    name: 'Nifty Midcap 150 Total Returns Index (TRI)',
    variant: 'TRI',
    assetClass: 'Equity',
  },
  {
    symbol: 'NIFTYSMALLCAP250.NS',
    name: 'Nifty Smallcap 250 Total Returns Index (TRI)',
    variant: 'TRI',
    assetClass: 'Equity',
  },
  {
    symbol: 'CRISIL_COMP_BOND',
    name: 'CRISIL Composite Bond Fund Index',
    variant: 'Index',
    assetClass: 'Debt',
  },
  {
    symbol: 'GOLD_DOMESTIC',
    name: 'Domestic Gold Spot Index (INR/10g)',
    variant: 'Index',
    assetClass: 'Commodity',
  },
];

const FIXED_NSE_HOLIDAYS = new Set([
  '01-26', // Republic Day
  '04-14', // Dr. Ambedkar Jayanti
  '05-01', // Maharashtra Day
  '08-15', // Independence Day
  '10-02', // Mahatma Gandhi Jayanti
  '12-25', // Christmas
]);

export function isNseTradingDay(isoDate: string): boolean {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !FIXED_NSE_HOLIDAYS.has(isoDate.slice(5));
}

export interface ExternalBenchmarkInput {
  series: NavPoint[];
  source: string;
  asOfDate?: string;
  variant?: 'TRI' | 'PRI' | 'Index';
  referenceDate?: string;
  maxStaleDays?: number;
}

/**
 * Resolves a benchmark strictly from an independent, verified external dataset.
 * Batch 1 Policy: Synthetic benchmark generation derived from any fund or static anchor
 * is completely removed. Calling this without an external verified source always returns
 * an explicit Unavailable status regardless of fund order, lead fund, or selection.
 */
export function resolveBenchmarkSeries(
  symbol: string,
  externalVerified?: ExternalBenchmarkInput | null
): BenchmarkStatus {
  const bm = BENCHMARKS.find((b) => b.symbol === symbol);

  if (!bm) {
    return {
      symbol,
      name: `Unknown Benchmark (${symbol})`,
      variant: 'Unavailable',
      available: false,
      source: null,
      asOfDate: null,
      reason: `Unknown benchmark symbol "${symbol}". Must match a registered official index definition.`,
      series: [],
    };
  }

  if (!externalVerified || !Array.isArray(externalVerified.series) || externalVerified.series.length === 0) {
    return {
      symbol: bm.symbol,
      name: bm.name,
      variant: 'Unavailable',
      available: false,
      source: null,
      asOfDate: null,
      reason: `Unavailable: Independent verified Total Returns Index (TRI) feed for ${bm.name} is not connected yet (Batch 2). Synthetic benchmark generation has been disabled.`,
      series: [],
    };
  }

  const validated = validateRawNavSeries(externalVerified.series, {
    provider: externalVerified.source,
    referenceDate: externalVerified.referenceDate,
    maxStaleDays: externalVerified.maxStaleDays ?? 36500, // allow historical fixtures unless caller specifies
  });

  if (!validated.validation.usable || validated.points.length === 0) {
    return {
      symbol: bm.symbol,
      name: bm.name,
      variant: 'Unavailable',
      available: false,
      source: externalVerified.source,
      asOfDate: validated.validation.latestDate,
      reason:
        validated.validation.unavailableReason ||
        `Benchmark feed from ${externalVerified.source} failed series validation.`,
      series: [],
    };
  }

  return {
    symbol: bm.symbol,
    name: bm.name,
    variant: externalVerified.variant || bm.variant,
    available: true,
    source: externalVerified.source,
    asOfDate: externalVerified.asOfDate || validated.points[validated.points.length - 1].date,
    reason: null,
    series: validated.points,
  };
}
