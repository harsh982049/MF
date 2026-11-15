import {
  AssetClass,
  BenchmarkCheckpoint,
  BenchmarkRegistryEntry,
  BenchmarkReturnVariant,
  BenchmarkRole,
  BenchmarkStatus,
  NavPoint,
  VerifiedBenchmarkSnapshot,
} from '../types/quant';
import { validateRawNavSeries } from '../utils/navValidator';
import verifiedTriSnapshotsRaw from './verifiedTriSnapshots.json';

export interface BenchmarkDefinition {
  symbol: string;
  name: string;
  variant: BenchmarkReturnVariant;
  assetClass: AssetClass;
}

const RAW_SNAPSHOTS = verifiedTriSnapshotsRaw as unknown as Record<string, VerifiedBenchmarkSnapshot>;

export const BENCHMARK_REGISTRY: Record<string, BenchmarkRegistryEntry> = {
  '^CRSLDX': {
    symbol: '^CRSLDX',
    providerIndexId: 'NSEI:NIFTY500_TRI',
    providerIndexName: 'NIFTY 500',
    name: 'Nifty 500 Total Returns Index (TRI)',
    currency: 'INR',
    returnVariant: 'TRI',
    assetClass: 'Equity',
    supported: true,
    sourceUri: 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
    sourceReportPage: 'https://www.niftyindices.com/reports/historical-data',
    effectiveFrom: RAW_SNAPSHOTS['^CRSLDX']?.coverageStart ?? '2013-01-01',
    effectiveTo: RAW_SNAPSHOTS['^CRSLDX']?.coverageEnd ?? '2026-11-13',
    checkpoints: RAW_SNAPSHOTS['^CRSLDX']?.checkpoints ?? [
      { date: '2026-11-05', nav: 37380.66 },
      { date: '2026-11-06', nav: 37760.81 },
      { date: '2026-11-12', nav: 38423.92 },
      { date: '2026-11-13', nav: 38212.79 },
    ],
  },
  '^NSEI': {
    symbol: '^NSEI',
    providerIndexId: 'NSEI:NIFTY50_TRI',
    providerIndexName: 'NIFTY 50',
    name: 'Nifty 50 Total Returns Index (TRI)',
    currency: 'INR',
    returnVariant: 'TRI',
    assetClass: 'Equity',
    supported: true,
    sourceUri: 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
    sourceReportPage: 'https://www.niftyindices.com/reports/historical-data',
    effectiveFrom: RAW_SNAPSHOTS['^NSEI']?.coverageStart ?? '2013-01-01',
    effectiveTo: RAW_SNAPSHOTS['^NSEI']?.coverageEnd ?? '2026-11-13',
    checkpoints: RAW_SNAPSHOTS['^NSEI']?.checkpoints ?? [
      { date: '2026-11-05', nav: 37299.45 },
      { date: '2026-11-06', nav: 38059.2 },
      { date: '2026-11-12', nav: 38473.73 },
      { date: '2026-11-13', nav: 38237.93 },
    ],
  },
  'NIFTYMIDCAP150.NS': {
    symbol: 'NIFTYMIDCAP150.NS',
    providerIndexId: 'NSEI:NIFTYMIDCAP150_TRI',
    providerIndexName: 'NIFTY MIDCAP 150',
    name: 'Nifty Midcap 150 Total Returns Index (TRI)',
    currency: 'INR',
    returnVariant: 'TRI',
    assetClass: 'Equity',
    supported: true,
    sourceUri: 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
    sourceReportPage: 'https://www.niftyindices.com/reports/historical-data',
    effectiveFrom: RAW_SNAPSHOTS['NIFTYMIDCAP150.NS']?.coverageStart ?? '2013-01-01',
    effectiveTo: RAW_SNAPSHOTS['NIFTYMIDCAP150.NS']?.coverageEnd ?? '2026-11-13',
    checkpoints: RAW_SNAPSHOTS['NIFTYMIDCAP150.NS']?.checkpoints ?? [
      { date: '2026-11-05', nav: 28516.03 },
      { date: '2026-11-06', nav: 28495.3 },
      { date: '2026-11-12', nav: 29126.36 },
      { date: '2026-11-13', nav: 29024.73 },
    ],
  },
  'NIFTYSMALLCAP250.NS': {
    symbol: 'NIFTYSMALLCAP250.NS',
    providerIndexId: 'NSEI:NIFTYSMALLCAP250_TRI',
    providerIndexName: 'NIFTY SMALLCAP 250',
    name: 'Nifty Smallcap 250 Total Returns Index (TRI)',
    currency: 'INR',
    returnVariant: 'TRI',
    assetClass: 'Equity',
    supported: true,
    sourceUri: 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
    sourceReportPage: 'https://www.niftyindices.com/reports/historical-data',
    effectiveFrom: RAW_SNAPSHOTS['NIFTYSMALLCAP250.NS']?.coverageStart ?? '2013-01-01',
    effectiveTo: RAW_SNAPSHOTS['NIFTYSMALLCAP250.NS']?.coverageEnd ?? '2026-11-13',
    checkpoints: RAW_SNAPSHOTS['NIFTYSMALLCAP250.NS']?.checkpoints ?? [
      { date: '2026-11-05', nav: 22417.46 },
      { date: '2026-11-06', nav: 22227.2 },
      { date: '2026-11-12', nav: 23007.94 },
      { date: '2026-11-13', nav: 22942.9 },
    ],
  },
  CRISIL_COMP_BOND: {
    symbol: 'CRISIL_COMP_BOND',
    providerIndexId: 'CRISIL:COMP_BOND_UNAVAILABLE',
    providerIndexName: 'CRISIL Composite Bond Fund Index',
    name: 'CRISIL Composite Bond Fund Index',
    currency: 'INR',
    returnVariant: 'Unavailable',
    assetClass: 'Debt',
    supported: false,
    sourceUri: null,
    sourceReportPage: null,
    effectiveFrom: null,
    effectiveTo: null,
    checkpoints: [],
  },
  GOLD_DOMESTIC: {
    symbol: 'GOLD_DOMESTIC',
    providerIndexId: 'COMMODITY:GOLD_DOMESTIC_UNAVAILABLE',
    providerIndexName: 'Domestic Gold Spot Index (INR/10g)',
    name: 'Domestic Gold Spot Index (INR/10g)',
    currency: 'INR',
    returnVariant: 'Unavailable',
    assetClass: 'Commodity',
    supported: false,
    sourceUri: null,
    sourceReportPage: null,
    effectiveFrom: null,
    effectiveTo: null,
    checkpoints: [],
  },
  UNAVAILABLE_INTL: {
    symbol: 'UNAVAILABLE_INTL',
    providerIndexId: 'INTL:UNAVAILABLE',
    providerIndexName: 'Unverified International Index',
    name: 'International Equity Benchmark (Unavailable)',
    currency: 'USD',
    returnVariant: 'Unavailable',
    assetClass: 'International',
    supported: false,
    sourceUri: null,
    sourceReportPage: null,
    effectiveFrom: null,
    effectiveTo: null,
    checkpoints: [],
  },
};

export const BENCHMARKS: BenchmarkDefinition[] = Object.values(BENCHMARK_REGISTRY).map((entry) => ({
  symbol: entry.symbol,
  name: entry.name,
  variant: entry.returnVariant,
  assetClass: entry.assetClass,
}));

export const BENCHMARK_IMPORT_SCHEMA_DOC = {
  schemaName: 'VerifiedBenchmarkSnapshot',
  requiredFields: [
    'symbol',
    'providerIndexId',
    'displayName',
    'currency',
    'returnVariant ("TRI" strictly)',
    'sourceUri',
    'fetchedAt (ISO-8601 UTC)',
    'snapshotVersion',
    'coverageStart (YYYY-MM-DD)',
    'coverageEnd (YYYY-MM-DD)',
    'checksumSha256 (64-hex SHA-256 of canonical series)',
    'series ([{ date: "YYYY-MM-DD", nav: number }])',
  ],
  canonicalChecksumRule:
    'SHA-256 over UTF-8 compact JSON array [{"date":"YYYY-MM-DD","nav":<float_with_dot_0_for_integers>},...] sorted ascending by date',
  supportedOfficialSymbols: ['^CRSLDX', '^NSEI', 'NIFTYMIDCAP150.NS', 'NIFTYSMALLCAP250.NS'],
  unsupportedExplicitSymbols: ['CRISIL_COMP_BOND', 'GOLD_DOMESTIC', 'UNAVAILABLE_INTL'],
} as const;

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

// Synchronous isomorphic SHA-256 over UTF-8 bytes (identical in Browser and Node.js)
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256HexUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Canonical cross-runtime SHA-256 checksum for a sorted series of benchmark NavPoints.
 * Matches Python `json.dumps([{"date": d, "nav": float(v)}, ...], separators=(",", ":"))`.
 */
export function computeCanonicalSeriesSha256(series: NavPoint[]): string {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const payload =
    '[' +
    sorted
      .map(
        (p) =>
          `{"date":${JSON.stringify(p.date)},"nav":${Number.isInteger(p.nav) ? `${p.nav}.0` : String(p.nav)}}`
      )
      .join(',') +
    ']';
  return sha256HexUtf8(payload);
}

/**
 * Scans an already-sorted benchmark series for multi-session calendar gaps (>4 days between sessions)
 * WITHOUT filling or interpolating missing observations.
 */
export function analyzeBenchmarkGaps(sortedPoints: NavPoint[]): {
  gapCount: number;
  maxGapCalendarDays: number | null;
  gapSpans: { fromDate: string; toDate: string; calendarDays: number }[];
} {
  if (!sortedPoints || sortedPoints.length < 2) {
    return { gapCount: 0, maxGapCalendarDays: null, gapSpans: [] };
  }
  const gapSpans: { fromDate: string; toDate: string; calendarDays: number }[] = [];
  let maxGap = 0;

  for (let i = 1; i < sortedPoints.length; i++) {
    const prevMs = Date.parse(`${sortedPoints[i - 1].date}T00:00:00Z`);
    const currMs = Date.parse(`${sortedPoints[i].date}T00:00:00Z`);
    const days = Math.round((currMs - prevMs) / 86400000);
    if (days > maxGap) maxGap = days;
    // Standard Sat/Sun weekend is 3 calendar days (Fri->Mon); extended holiday/long-weekend >4 calendar days
    if (days > 4) {
      gapSpans.push({
        fromDate: sortedPoints[i - 1].date,
        toDate: sortedPoints[i].date,
        calendarDays: days,
      });
    }
  }

  return {
    gapCount: gapSpans.length,
    maxGapCalendarDays: maxGap,
    gapSpans,
  };
}

export interface BenchmarkValidationOptions {
  role?: BenchmarkRole;
  allowTestFixture?: boolean;
  valuationCutoffDate?: string;
  referenceDate?: string;
  maxStaleDays?: number;
  expectedCheckpoints?: BenchmarkCheckpoint[];
}

function buildUnavailableBenchmarkStatus(
  symbol: string,
  name: string,
  role: BenchmarkRole,
  reason: string,
  extra: Partial<BenchmarkStatus> = {}
): BenchmarkStatus {
  const reg = BENCHMARK_REGISTRY[symbol];
  return {
    symbol,
    name: name || reg?.name || `Unknown Benchmark (${symbol})`,
    variant: 'Unavailable',
    available: false,
    source: null,
    asOfDate: null,
    reason,
    series: [],
    providerIndexId: reg?.providerIndexId ?? null,
    currency: reg?.currency ?? 'INR',
    role,
    sourceUri: reg?.sourceUri ?? null,
    fetchedAt: null,
    snapshotVersion: null,
    checksumSha256: null,
    coverageStart: null,
    coverageEnd: null,
    observationCount: 0,
    gapCount: 0,
    maxGapCalendarDays: null,
    gapSpans: [],
    checkpointVerified: false,
    isTestFixture: false,
    effectiveFrom: reg?.effectiveFrom ?? null,
    effectiveTo: reg?.effectiveTo ?? null,
    ...extra,
  };
}

/**
 * Validates a structured VerifiedBenchmarkSnapshot against the benchmark registry,
 * TRI variant rules, production fixture gates, NAV series integrity, SHA-256 checksum,
 * and official level checkpoints. Preserves calendar gaps verbatim (never fills gaps).
 */
export function validateBenchmarkSnapshot(
  snapshot: VerifiedBenchmarkSnapshot | null | undefined,
  options: BenchmarkValidationOptions = {}
): BenchmarkStatus {
  const role: BenchmarkRole = options.role ?? 'common_comparator';
  if (!snapshot) {
    return buildUnavailableBenchmarkStatus('', 'Unavailable', role, 'Benchmark snapshot is missing.');
  }

  const reg = BENCHMARK_REGISTRY[snapshot.symbol];
  if (!reg) {
    return buildUnavailableBenchmarkStatus(
      snapshot.symbol,
      snapshot.displayName || `Unknown Benchmark (${snapshot.symbol})`,
      role,
      `Unknown benchmark symbol "${snapshot.symbol}". Must match a registered official index definition.`
    );
  }

  if (!reg.supported) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Unavailable: ${reg.name} (${reg.assetClass}) has no permitted verified TRI dataset in Batch 2.`
    );
  }

  if (snapshot.isTestFixture && !options.allowTestFixture) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Unavailable in production mode: imported snapshot ${snapshot.snapshotVersion} is labelled as a test fixture (allowTestFixture=false).`,
      { isTestFixture: true, snapshotVersion: snapshot.snapshotVersion }
    );
  }

  if (snapshot.returnVariant !== 'TRI' || reg.returnVariant !== 'TRI') {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Rejected benchmark snapshot for ${reg.symbol}: returnVariant "${snapshot.returnVariant}" is not exact TRI (Price Return Index or derived series cannot be relabeled as TRI).`
    );
  }

  if ((snapshot.providerIndexId || '').trim() !== reg.providerIndexId) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Provider index identifier mismatch on ${reg.symbol}: expected "${reg.providerIndexId}", got "${snapshot.providerIndexId}".`
    );
  }

  if ((snapshot.currency || '').trim().toUpperCase() !== reg.currency) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Currency mismatch on ${reg.symbol}: expected ${reg.currency}, got "${snapshot.currency}".`
    );
  }

  if (!snapshot.checksumSha256 || !/^[a-f0-9]{64}$/i.test(snapshot.checksumSha256.trim())) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Missing or invalid SHA-256 checksum on benchmark snapshot "${snapshot.snapshotVersion}".`
    );
  }

  const cutoff =
    options.valuationCutoffDate ||
    options.referenceDate ||
    snapshot.coverageEnd ||
    reg.effectiveTo ||
    '2026-11-15';

  const validated = validateRawNavSeries(snapshot.series, {
    provider: snapshot.sourceUri,
    valuationCutoffDate: cutoff,
    maxStaleDays: options.maxStaleDays ?? 36500,
    corporateActions: [],
  });

  if (!validated.validation.usable || validated.points.length === 0) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      validated.validation.unavailableReason ||
        `Benchmark snapshot "${snapshot.snapshotVersion}" failed time-series validation.`
    );
  }

  const sortedPoints = validated.points;
  const computedSha = computeCanonicalSeriesSha256(sortedPoints);
  const expectedSha = snapshot.checksumSha256.trim().toLowerCase();
  if (computedSha !== expectedSha) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Checksum verification failed for ${reg.symbol} snapshot "${snapshot.snapshotVersion}": expected ${expectedSha}, computed ${computedSha}.`
    );
  }

  if (validated.validation.quarantinedFromBreak) {
    const firstBreak = validated.validation.corporateActionBreaks[0];
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Benchmark series contains unadjusted discontinuity on ${firstBreak.date} (${firstBreak.pctChange}%).`
    );
  }

  const earliestDate = sortedPoints[0].date;
  const latestDate = sortedPoints[sortedPoints.length - 1].date;
  if (
    (snapshot.coverageStart && snapshot.coverageStart !== earliestDate) ||
    (snapshot.coverageEnd && snapshot.coverageEnd !== latestDate)
  ) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Declared coverage (${snapshot.coverageStart}..${snapshot.coverageEnd}) does not match actual series span (${earliestDate}..${latestDate}).`
    );
  }

  const pointMap = new Map(sortedPoints.map((p) => [p.date, p.nav]));
  const checkpointsToVerify =
    options.expectedCheckpoints ??
    (!snapshot.isTestFixture ? reg.checkpoints : snapshot.checkpoints ?? []);

  let verifiedCheckpointsCount = 0;
  for (const cp of checkpointsToVerify) {
    if (cp.date < earliestDate || cp.date > latestDate) continue;
    const actual = pointMap.get(cp.date);
    const tol = cp.tolerance ?? 1e-2;
    if (actual === undefined) {
      return buildUnavailableBenchmarkStatus(
        reg.symbol,
        reg.name,
        role,
        `Checkpoint missing on ${cp.date} for ${reg.symbol} (${reg.providerIndexId}).`
      );
    }
    if (Math.abs(actual - cp.nav) > tol) {
      return buildUnavailableBenchmarkStatus(
        reg.symbol,
        reg.name,
        role,
        `Checkpoint value mismatch on ${cp.date} for ${reg.symbol}: expected ${cp.nav}, got ${actual}.`
      );
    }
    verifiedCheckpointsCount++;
  }

  if (!snapshot.isTestFixture && reg.checkpoints.length > 0 && verifiedCheckpointsCount === 0) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Snapshot for ${reg.symbol} (${earliestDate}..${latestDate}) overlaps zero registered official checkpoints.`
    );
  }

  const gapStats = analyzeBenchmarkGaps(sortedPoints);

  return {
    symbol: reg.symbol,
    name: reg.name,
    variant: 'TRI',
    available: true,
    source: `${reg.providerIndexId} · ${snapshot.snapshotVersion}`,
    asOfDate: latestDate,
    reason: null,
    series: sortedPoints,
    providerIndexId: reg.providerIndexId,
    currency: reg.currency,
    role,
    sourceUri: snapshot.sourceUri,
    fetchedAt: snapshot.fetchedAt,
    snapshotVersion: snapshot.snapshotVersion,
    checksumSha256: expectedSha,
    coverageStart: earliestDate,
    coverageEnd: latestDate,
    observationCount: sortedPoints.length,
    gapCount: gapStats.gapCount,
    maxGapCalendarDays: gapStats.maxGapCalendarDays,
    gapSpans: gapStats.gapSpans,
    checkpointVerified: verifiedCheckpointsCount > 0 || Boolean(snapshot.isTestFixture),
    isTestFixture: Boolean(snapshot.isTestFixture),
    effectiveFrom: reg.effectiveFrom,
    effectiveTo: reg.effectiveTo,
  };
}

export interface SnapshotImportResult {
  ok: boolean;
  deduplicated: boolean;
  reason: string | null;
  status: BenchmarkStatus;
}

/**
 * In-memory validated store supporting idempotent snapshot imports and reproducible resolution.
 */
export class BenchmarkSnapshotStore {
  private readonly snapshots = new Map<string, VerifiedBenchmarkSnapshot>();
  private readonly validatedCache = new Map<string, BenchmarkStatus>();

  importSnapshot(
    snapshot: VerifiedBenchmarkSnapshot,
    options: BenchmarkValidationOptions = {}
  ): SnapshotImportResult {
    const existing = this.snapshots.get(snapshot.symbol);
    if (existing) {
      const sameVersion = existing.snapshotVersion === snapshot.snapshotVersion;
      const sameChecksum =
        existing.checksumSha256.toLowerCase() === snapshot.checksumSha256.toLowerCase();
      if (sameVersion && sameChecksum) {
        const cached =
          this.validatedCache.get(snapshot.symbol) ??
          validateBenchmarkSnapshot(existing, options);
        return { ok: true, deduplicated: true, reason: null, status: cached };
      }
      if (sameVersion && !sameChecksum) {
        const reason = `Conflicting checksum for ${snapshot.symbol} snapshotVersion "${snapshot.snapshotVersion}". Increment snapshotVersion for new verified data.`;
        return {
          ok: false,
          deduplicated: false,
          reason,
          status: buildUnavailableBenchmarkStatus(
            snapshot.symbol,
            snapshot.displayName,
            options.role ?? 'common_comparator',
            reason
          ),
        };
      }
    }

    const validated = validateBenchmarkSnapshot(snapshot, options);
    if (!validated.available) {
      return {
        ok: false,
        deduplicated: false,
        reason: validated.reason,
        status: validated,
      };
    }

    this.snapshots.set(snapshot.symbol, {
      ...snapshot,
      series: validated.series.map((p) => ({ date: p.date, nav: p.nav })),
    });
    this.validatedCache.set(snapshot.symbol, validated);
    return {
      ok: true,
      deduplicated: false,
      reason: null,
      status: validated,
    };
  }

  getSnapshot(symbol: string): VerifiedBenchmarkSnapshot | null {
    return this.snapshots.get(symbol) ?? null;
  }

  resolve(
    symbol: string,
    role: BenchmarkRole = 'common_comparator',
    options: BenchmarkValidationOptions = {}
  ): BenchmarkStatus {
    const reg = BENCHMARK_REGISTRY[symbol];
    if (!reg) {
      return buildUnavailableBenchmarkStatus(
        symbol,
        `Unknown Benchmark (${symbol})`,
        role,
        `Unknown benchmark symbol "${symbol}". Must match a registered official index definition.`
      );
    }

    if (!reg.supported) {
      return buildUnavailableBenchmarkStatus(
        reg.symbol,
        reg.name,
        role,
        `Unavailable: ${reg.name} (${reg.assetClass}) has no permitted verified TRI dataset in Batch 2.`
      );
    }

    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) {
      return buildUnavailableBenchmarkStatus(
        reg.symbol,
        reg.name,
        role,
        `Unavailable: Verified official TRI snapshot for ${reg.name} (${reg.providerIndexId}) is not loaded.`
      );
    }

    const baseStatus = validateBenchmarkSnapshot(snapshot, { ...options, role });
    return { ...baseStatus, role };
  }
}

export function createDefaultVerifiedBenchmarkStore(): BenchmarkSnapshotStore {
  const store = new BenchmarkSnapshotStore();
  for (const snap of Object.values(RAW_SNAPSHOTS)) {
    store.importSnapshot(snap, { allowTestFixture: false });
  }
  return store;
}

export const VERIFIED_BENCHMARK_STORE = createDefaultVerifiedBenchmarkStore();

/**
 * Resolves a benchmark using the verified official TRI snapshot store (Batch 2).
 * Strictly invariant to fund selection, ordering, additions, or removals.
 * Unsupported asset classes (Debt/Commodity/International) and unverified symbols emit Unavailable.
 */
export function resolveVerifiedBenchmarkSeries(
  symbol: string,
  role: BenchmarkRole = 'common_comparator',
  options: BenchmarkValidationOptions = {}
): BenchmarkStatus {
  return VERIFIED_BENCHMARK_STORE.resolve(symbol, role, options);
}

export interface ExternalBenchmarkInput {
  series: NavPoint[];
  source: string;
  asOfDate?: string;
  variant?: BenchmarkReturnVariant;
  referenceDate?: string;
  maxStaleDays?: number;
  providerIndexId?: string;
  currency?: string;
  snapshotVersion?: string;
  checksumSha256?: string;
  isTestFixture?: boolean;
  allowTestFixture?: boolean;
}

/**
 * Resolves a benchmark strictly from an explicit caller-supplied verified external dataset.
 * Calling without `externalVerified` preserves Batch 1's explicit Unavailable behavior.
 * Enforces TRI variant, registry definition, and series integrity when external data is supplied.
 */
export function resolveBenchmarkSeries(
  symbol: string,
  externalVerified?: ExternalBenchmarkInput | VerifiedBenchmarkSnapshot | null,
  role: BenchmarkRole = 'common_comparator'
): BenchmarkStatus {
  const reg = BENCHMARK_REGISTRY[symbol];

  if (!reg) {
    return buildUnavailableBenchmarkStatus(
      symbol,
      `Unknown Benchmark (${symbol})`,
      role,
      `Unknown benchmark symbol "${symbol}". Must match a registered official index definition.`
    );
  }

  if (!reg.supported) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Unavailable: ${reg.name} (${reg.assetClass}) has no permitted verified TRI dataset in Batch 2.`
    );
  }

  if (!externalVerified || !Array.isArray(externalVerified.series) || externalVerified.series.length === 0) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Unavailable: Verified external TRI feed not supplied to resolveBenchmarkSeries(${reg.symbol}). Use resolveVerifiedBenchmarkSeries(${reg.symbol}) to query verified official snapshots.`
    );
  }

  // Full VerifiedBenchmarkSnapshot path
  if ('checksumSha256' in externalVerified && typeof externalVerified.checksumSha256 === 'string' && 'snapshotVersion' in externalVerified && typeof externalVerified.snapshotVersion === 'string') {
    const allowFixture = 'allowTestFixture' in externalVerified ? Boolean(externalVerified.allowTestFixture) : false;
    return validateBenchmarkSnapshot(externalVerified as VerifiedBenchmarkSnapshot, {
      role,
      allowTestFixture: allowFixture,
    });
  }

  const ext = externalVerified as ExternalBenchmarkInput;
  const requestedVariant = ext.variant || reg.returnVariant;
  if (requestedVariant !== 'TRI') {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Rejected benchmark feed from ${ext.source}: variant "${requestedVariant}" is not exact TRI (PRI/Index cannot be relabeled as TRI).`
    );
  }

  if (ext.isTestFixture && !ext.allowTestFixture) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      `Unavailable in production mode: test fixture benchmark from ${ext.source} blocked.`
    );
  }

  const validated = validateRawNavSeries(ext.series, {
    provider: ext.source,
    referenceDate: ext.referenceDate,
    maxStaleDays: ext.maxStaleDays ?? 36500,
    corporateActions: [],
  });

  if (!validated.validation.usable || validated.points.length === 0) {
    return buildUnavailableBenchmarkStatus(
      reg.symbol,
      reg.name,
      role,
      validated.validation.unavailableReason ||
        `Benchmark feed from ${ext.source} failed series validation.`,
      {
        source: ext.source,
        asOfDate: validated.validation.latestDate,
      }
    );
  }

  const gapStats = analyzeBenchmarkGaps(validated.points);
  const sha = computeCanonicalSeriesSha256(validated.points);

  return {
    symbol: reg.symbol,
    name: reg.name,
    variant: 'TRI',
    available: true,
    source: ext.source,
    asOfDate: ext.asOfDate || validated.points[validated.points.length - 1].date,
    reason: null,
    series: validated.points,
    providerIndexId: reg.providerIndexId,
    currency: reg.currency,
    role,
    sourceUri: ext.source,
    fetchedAt: new Date().toISOString(),
    snapshotVersion: ext.snapshotVersion ?? 'external-verified',
    checksumSha256: sha,
    coverageStart: validated.points[0].date,
    coverageEnd: validated.points[validated.points.length - 1].date,
    observationCount: validated.points.length,
    gapCount: gapStats.gapCount,
    maxGapCalendarDays: gapStats.maxGapCalendarDays,
    gapSpans: gapStats.gapSpans,
    checkpointVerified: false,
    isTestFixture: Boolean(ext.isTestFixture),
    effectiveFrom: reg.effectiveFrom,
    effectiveTo: reg.effectiveTo,
  };
}

/**
 * Optional live NSE Indices TRI fetcher for browser runtime / CLI refresh scripts.
 * Parses NIFTY Total Returns Index endpoint JSON into a checksummed VerifiedBenchmarkSnapshot.
 */
export async function fetchLiveNseTriBenchmark(
  symbol: string,
  startDateDdMmmYyyy: string,
  endDateDdMmmYyyy: string,
  fetchImpl: typeof fetch = fetch
): Promise<VerifiedBenchmarkSnapshot | null> {
  const reg = BENCHMARK_REGISTRY[symbol];
  if (!reg || !reg.supported) return null;

  const endpoints = [
    '/api/niftyindices/BackPage/getTotalReturnIndexString',
    'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
  ];

  const payload = {
    cinfo: JSON.stringify({
      name: reg.providerIndexName,
      startDate: startDateDdMmmYyyy,
      endDate: endDateDdMmmYyyy,
      indexName: reg.providerIndexName,
    }),
  };

  for (const url of endpoints) {
    try {
      const resp = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) continue;
      const json = (await resp.json()) as { d?: string };
      if (!json?.d) continue;
      const rows = JSON.parse(json.d) as { Date?: string; TotalReturnsIndex?: string }[];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const parsed: NavPoint[] = [];
      for (const row of rows) {
        const rawDate = (row.Date || '').trim();
        const val = Number(row.TotalReturnsIndex);
        if (!rawDate || !Number.isFinite(val) || val <= 0) continue;
        const dt = new Date(`${rawDate} 12:00:00 UTC`);
        if (Number.isNaN(dt.getTime())) continue;
        const iso = dt.toISOString().slice(0, 10);
        parsed.push({ date: iso, nav: val });
      }
      if (parsed.length === 0) continue;

      parsed.sort((a, b) => a.date.localeCompare(b.date));
      const dedupedMap = new Map<string, number>();
      for (const p of parsed) dedupedMap.set(p.date, p.nav);
      const series = Array.from(dedupedMap.entries())
        .map(([date, nav]) => ({ date, nav }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const coverageStart = series[0].date;
      const coverageEnd = series[series.length - 1].date;
      return {
        symbol: reg.symbol,
        providerIndexId: reg.providerIndexId,
        providerIndexName: reg.providerIndexName,
        displayName: reg.name,
        currency: reg.currency,
        returnVariant: 'TRI',
        sourceUri: reg.sourceUri || 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
        sourceReportPage: reg.sourceReportPage,
        fetchedAt: new Date().toISOString(),
        snapshotVersion: `nse-tri-${coverageEnd}-live`,
        coverageStart,
        coverageEnd,
        observationCount: series.length,
        checksumSha256: computeCanonicalSeriesSha256(series),
        series,
      };
    } catch {
      // Try next endpoint
    }
  }

  return null;
}
