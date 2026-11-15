import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BENCHMARK_REGISTRY,
  BenchmarkSnapshotStore,
  analyzeBenchmarkGaps,
  computeCanonicalSeriesSha256,
  resolveBenchmarkSeries,
  resolveVerifiedBenchmarkSeries,
  validateBenchmarkSnapshot,
} from '../data/genuineBenchmarks';
import { PRESET_FUNDS, validateMfapiPayload } from '../data/presetFunds';
import {
  applyCorporateActionsToSeries,
  VERIFIED_CORPORATE_ACTIONS,
  validateRawNavSeries,
} from '../utils/navValidator';
import {
  computeBenchmarkAlignmentSummary,
  computeComprehensiveMetrics,
  computeRollingReturns,
  computeTrailingCagrWithMeta,
  simulateMonthlySip,
} from '../utils/quantEngine';
import {
  buildComparisonCsv,
  buildComparisonJsonPayload,
  buildRawNavCsv,
  buildSingleFundFactsheetCsv,
  ExportBuilderInput,
} from '../components/DataExportModal';
import {
  CorporateActionRecord,
  FundMeta,
  NavPoint,
  VerifiedBenchmarkSnapshot,
} from '../types/quant';
import { addSchemeWorkflow, previewSchemeWorkflow } from '../utils/schemeWorkflow';
import { validateSchemeIdentity } from '../utils/schemeIdentity';

function makeJsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateTradingSeries(
  startIso: string,
  sessions: number,
  startNav: number,
  dailyRet: number = 0.0005
): { date: string; nav: string }[] {
  const out: { date: string; nav: string }[] = [];
  let nav = startNav;
  const dt = new Date(`${startIso}T00:00:00Z`);
  while (out.length < sessions) {
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) {
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = dt.getUTCFullYear();
      out.push({ date: `${dd}-${mm}-${yyyy}`, nav: nav.toFixed(4) });
      nav *= 1 + dailyRet;
    }
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return out;
}

describe('Batch 2 Regression Suite: Authentic Benchmarks & Split-Aware NAV Validation', () => {
  describe('Part 1: Benchmark Registry, Official NSE TRI Snapshots, Checksums & Rejection Gates', () => {
    it('defines complete registry metadata and distinguishes scheme_default vs common_comparator roles', () => {
      const n500 = BENCHMARK_REGISTRY['^CRSLDX'];
      const mid150 = BENCHMARK_REGISTRY['NIFTYMIDCAP150.NS'];
      const debt = BENCHMARK_REGISTRY['CRISIL_COMP_BOND'];
      const gold = BENCHMARK_REGISTRY['GOLD_DOMESTIC'];
      const intl = BENCHMARK_REGISTRY['UNAVAILABLE_INTL'];

      assert.equal(n500.providerIndexId, 'NSEI:NIFTY500_TRI');
      assert.equal(n500.returnVariant, 'TRI');
      assert.equal(n500.currency, 'INR');
      assert.equal(n500.supported, true);
      assert.ok(n500.effectiveFrom && n500.effectiveTo);

      assert.equal(mid150.providerIndexId, 'NSEI:NIFTYMIDCAP150_TRI');
      assert.equal(mid150.returnVariant, 'TRI');
      assert.equal(mid150.supported, true);

      // Confirm PPFAS (122639) -> Nifty 500 TRI and MO Midcap (127042) -> Nifty Midcap 150 TRI
      assert.equal(PRESET_FUNDS[122639].benchmark_symbol, '^CRSLDX');
      assert.equal(PRESET_FUNDS[127042].benchmark_symbol, 'NIFTYMIDCAP150.NS');

      // Dual roles cleanly tagged
      const schemeDefaultN500 = resolveVerifiedBenchmarkSeries('^CRSLDX', 'scheme_default');
      const comparatorMid150 = resolveVerifiedBenchmarkSeries('NIFTYMIDCAP150.NS', 'common_comparator');
      assert.equal(schemeDefaultN500.available, true);
      assert.equal(schemeDefaultN500.role, 'scheme_default');
      assert.equal(comparatorMid150.available, true);
      assert.equal(comparatorMid150.role, 'common_comparator');

      // Unsupported Debt/Commodity/Intl remain explicitly Unavailable
      for (const unsupported of [debt.symbol, gold.symbol, intl.symbol, 'UNKNOWN_SYM']) {
        const res = resolveVerifiedBenchmarkSeries(unsupported, 'scheme_default');
        assert.equal(res.available, false);
        assert.equal(res.variant, 'Unavailable');
        assert.equal(res.series.length, 0);
      }
    });

    it('loads verified official NSE Indices TRI snapshots with exact SHA-256 checksums, checkpoints, and gap visibility', () => {
      const bm = resolveVerifiedBenchmarkSeries('^CRSLDX', 'common_comparator');
      assert.equal(bm.available, true);
      assert.equal(bm.variant, 'TRI');
      assert.equal(bm.providerIndexId, 'NSEI:NIFTY500_TRI');
      assert.equal(bm.coverageStart, '2013-01-01');
      assert.equal(bm.coverageEnd, '2026-11-13');
      assert.equal(bm.observationCount, 3435);
      assert.equal(bm.checkpointVerified, true);
      assert.equal(bm.isTestFixture, false);
      assert.equal(bm.checksumSha256, computeCanonicalSeriesSha256(bm.series));

      // Verify exact official NSE TRI movement checkpoints without interpolation
      const map = new Map(bm.series.map((p) => [p.date, p.nav]));
      assert.equal(map.get('2026-11-05'), 37380.66);
      assert.equal(map.get('2026-11-06'), 37760.81);
      const nov6MovePct = Number((((37760.81 / 37380.66) - 1) * 100).toFixed(2));
      assert.equal(nov6MovePct, 1.02);

      // Sunday Diwali Muhurat trading session (2026-11-08) is genuine NSE data — kept verbatim
      assert.equal(map.get('2026-11-08'), 37812.73);
      assert.equal(map.get('2026-11-07'), undefined); // Saturday stays absent (no gap-filling!)

      assert.equal(map.get('2026-11-12'), 38423.92);
      assert.equal(map.get('2026-11-13'), 38212.79);
      const nov13MovePct = Number((((38212.79 / 38423.92) - 1) * 100).toFixed(2));
      assert.equal(nov13MovePct, -0.55);

      const gapStats = analyzeBenchmarkGaps(bm.series);
      assert.equal(bm.gapCount, gapStats.gapCount);
      assert.ok((bm.gapCount ?? 0) > 0);
      assert.ok((bm.maxGapCalendarDays ?? 0) >= 5);

      // Other verified Equity TRI benchmarks
      assert.equal(resolveVerifiedBenchmarkSeries('^NSEI').available, true);
      assert.equal(resolveVerifiedBenchmarkSeries('NIFTYMIDCAP150.NS').available, true);
      assert.equal(resolveVerifiedBenchmarkSeries('NIFTYSMALLCAP250.NS').available, true);

      // Preserve Batch 1 contract: calling 1-arg resolveBenchmarkSeries without external input stays Unavailable
      assert.equal(resolveBenchmarkSeries('^CRSLDX').available, false);
    });

    it('rejects PRI relabeling, corrupt checksums, checkpoint tampering, duplicate conflicts, stale data, and unpermitted test fixtures', () => {
      const fixtureSeries: NavPoint[] = [
        { date: '2026-11-04', nav: 37100.0 },
        { date: '2026-11-05', nav: 37380.66 },
        { date: '2026-11-06', nav: 37760.81 },
      ];
      const baseSnapshot: VerifiedBenchmarkSnapshot = {
        symbol: '^CRSLDX',
        providerIndexId: 'NSEI:NIFTY500_TRI',
        displayName: 'Nifty 500 TRI Fixture',
        currency: 'INR',
        returnVariant: 'TRI',
        sourceUri: 'https://test.local/nse-tri-fixture',
        fetchedAt: '2026-11-15T00:00:00Z',
        snapshotVersion: 'test-fixture-v1',
        coverageStart: '2026-11-04',
        coverageEnd: '2026-11-06',
        checksumSha256: computeCanonicalSeriesSha256(fixtureSeries),
        isTestFixture: true,
        series: fixtureSeries,
      };

      // 1. Test fixture MUST be blocked in production mode (allowTestFixture=false / default)
      const blockedProd = validateBenchmarkSnapshot(baseSnapshot);
      assert.equal(blockedProd.available, false);
      assert.match(blockedProd.reason || '', /test fixture/i);

      // 2. Test fixture accepted when allowTestFixture=true and labelled cleanly
      const allowedFixture = validateBenchmarkSnapshot(baseSnapshot, { allowTestFixture: true });
      assert.equal(allowedFixture.available, true);
      assert.equal(allowedFixture.isTestFixture, true);

      // 3. Reject PRI or Index relabeled inputs
      const priRejected = validateBenchmarkSnapshot(
        { ...baseSnapshot, returnVariant: 'PRI' },
        { allowTestFixture: true }
      );
      assert.equal(priRejected.available, false);
      assert.match(priRejected.reason || '', /not exact TRI/i);

      const extPriRejected = resolveBenchmarkSeries('^CRSLDX', {
        series: fixtureSeries,
        source: 'Test Feed',
        variant: 'PRI',
      });
      assert.equal(extPriRejected.available, false);
      assert.match(extPriRejected.reason || '', /not exact TRI/i);

      // 4. Reject corrupt SHA-256 checksum
      const badSha = validateBenchmarkSnapshot(
        { ...baseSnapshot, checksumSha256: '0'.repeat(64) },
        { allowTestFixture: true }
      );
      assert.equal(badSha.available, false);
      assert.match(badSha.reason || '', /Checksum verification failed/i);

      // 5. Reject checkpoint mismatch on official data
      const tamperedSeries = fixtureSeries.map((p) =>
        p.date === '2026-11-06' ? { ...p, nav: 38000.0 } : p
      );
      const tamperedSnap: VerifiedBenchmarkSnapshot = {
        ...baseSnapshot,
        isTestFixture: false,
        series: tamperedSeries,
        checksumSha256: computeCanonicalSeriesSha256(tamperedSeries),
      };
      const badCheckpoint = validateBenchmarkSnapshot(tamperedSnap);
      assert.equal(badCheckpoint.available, false);
      assert.match(badCheckpoint.reason || '', /Checkpoint value mismatch/i);

      // 6. Reject conflicting duplicate dates & stale series & wrong currency
      const conflictSeries = [...fixtureSeries, { date: '2026-11-05', nav: 11111.0 }];
      const conflictSnap: VerifiedBenchmarkSnapshot = {
        ...baseSnapshot,
        series: conflictSeries,
        checksumSha256: computeCanonicalSeriesSha256(conflictSeries),
      };
      assert.equal(validateBenchmarkSnapshot(conflictSnap, { allowTestFixture: true }).available, false);

      const staleSnap = validateBenchmarkSnapshot(baseSnapshot, {
        allowTestFixture: true,
        valuationCutoffDate: '2026-12-30',
        maxStaleDays: 14,
      });
      assert.equal(staleSnap.available, false);
      assert.match(staleSnap.reason || '', /Stale/i);

      const wrongCcy = validateBenchmarkSnapshot(
        { ...baseSnapshot, currency: 'USD' },
        { allowTestFixture: true }
      );
      assert.equal(wrongCcy.available, false);
    });

    it('enforces idempotent store imports and invariance to fund ordering, additions, and removals', () => {
      const store = new BenchmarkSnapshotStore();
      const s1: NavPoint[] = [
        { date: '2026-11-05', nav: 37380.66 },
        { date: '2026-11-06', nav: 37760.81 },
      ];
      const snap: VerifiedBenchmarkSnapshot = {
        symbol: '^CRSLDX',
        providerIndexId: 'NSEI:NIFTY500_TRI',
        displayName: 'Nifty 500 TRI',
        currency: 'INR',
        returnVariant: 'TRI',
        sourceUri: 'https://www.niftyindices.com/BackPage/getTotalReturnIndexString',
        fetchedAt: '2026-11-15T16:35:00Z',
        snapshotVersion: 'nse-tri-2026-11-06-v1',
        coverageStart: '2026-11-05',
        coverageEnd: '2026-11-06',
        checksumSha256: computeCanonicalSeriesSha256(s1),
        series: s1,
      };

      const first = store.importSnapshot(snap);
      const second = store.importSnapshot(snap);
      assert.equal(first.ok, true);
      assert.equal(first.deduplicated, false);
      assert.equal(second.ok, true);
      assert.equal(second.deduplicated, true);
      assert.deepEqual(first.status.series, second.status.series);

      // Same snapshotVersion with changed checksum is rejected
      const mutated: NavPoint[] = [
        { date: '2026-11-05', nav: 37380.66 },
        { date: '2026-11-06', nav: 37760.82 },
      ];
      const conflict = store.importSnapshot({
        ...snap,
        series: mutated,
        checksumSha256: computeCanonicalSeriesSha256(mutated),
      });
      assert.equal(conflict.ok, false);
      assert.match(conflict.reason || '', /Conflicting checksum/i);

      // Benchmark resolution invariance regardless of selected fund list / lead order
      const rLeadA = resolveVerifiedBenchmarkSeries('^CRSLDX', 'common_comparator');
      const rLeadB = resolveVerifiedBenchmarkSeries('^CRSLDX', 'common_comparator');
      assert.equal(rLeadA.checksumSha256, rLeadB.checksumSha256);
      assert.equal(rLeadA.series.length, rLeadB.series.length);
      assert.deepEqual(rLeadA.series.slice(-5), rLeadB.series.slice(-5));
    });

    it('aligns fund vs benchmark strictly on common observed dates while keeping legitimate non-benchmark fund dates intact', () => {
      const bm = resolveVerifiedBenchmarkSeries('^CRSLDX', 'common_comparator');
      // Build a fund series spanning late 2025..2026-11-13 PLUS a legitimate fund NAV on Saturday 2026-11-07
      // (outside NSE session calendar, which instead has Sunday 2026-11-08 Muhurat trading)
      const fundSeries: NavPoint[] = bm.series
        .filter((p) => p.date >= '2025-11-01' && p.date <= '2026-11-13')
        .map((p, idx) => ({
          date: p.date,
          nav: Number((100 * Math.pow(1.0005, idx)).toFixed(4)),
        }));
      // Inject legitimate extra fund observation on 2026-11-07 (not in NSE equity benchmark)
      fundSeries.push({ date: '2026-11-07', nav: 112.1234 });
      fundSeries.sort((a, b) => a.date.localeCompare(b.date));

      const alignment = computeBenchmarkAlignmentSummary(fundSeries, bm.series);
      assert.equal(alignment.exactStartEndAligned, true);
      assert.equal(alignment.fundOnlyDatesCount, 1);
      assert.ok(alignment.benchOnlyDatesCount > 3000);
      assert.equal(alignment.alignedStartDate, '2025-11-03');
      assert.equal(alignment.alignedEndDate, '2026-11-13');

      const rm = computeComprehensiveMetrics(
        fundSeries,
        bm.series,
        'Alignment Test Fund',
        122639,
        'Flexi Cap',
        'Equity',
        0.065,
        [],
        { symbol: bm.symbol, role: 'common_comparator' }
      );
      assert.equal(rm.fundOnlyAvailable, true);
      assert.equal(rm.benchmarkRelativeAvailable, true);
      // Fund-only observationCount retains the legitimate Saturday 2026-11-07 date!
      assert.equal(rm.observationCount, fundSeries.length);
      assert.equal(rm.alignmentSummary?.fundOnlyDatesCount, 1);
      assert.equal(rm.alignmentSummary?.alignedCount, alignment.alignedCount);
      assert.equal(rm.benchmarkSymbolApplied, '^CRSLDX');
      assert.equal(rm.benchmarkRoleApplied, 'common_comparator');
      assert.notEqual(rm.beta, null);
      assert.notEqual(rm.jensensAlpha, null);
      assert.notEqual(rm.trackingError, null);
    });
  });

  describe('Part 2: Split-Aware NAV Validation (HDFC Gold ETF 113049 & Edge Cases)', () => {
    function buildHdfcGoldEtfFixtureSeries(): { date: string; nav: string }[] {
      // Genuine AMFI daily trajectory around 2021-02-19 (4120.0604) -> 2021-02-22 (41.5242) split
      const rows: { date: string; nav: string }[] = [];
      const dt = new Date('2019-06-03T00:00:00Z');
      while (dt.toISOString().slice(0, 10) <= '2023-06-30') {
        const day = dt.getUTCDay();
        if (day !== 0 && day !== 6) {
          const iso = dt.toISOString().slice(0, 10);
          const dd = iso.slice(8, 10);
          const mm = iso.slice(5, 7);
          const yyyy = iso.slice(0, 4);
          let nav: number;
          if (iso === '2021-02-19') {
            nav = 4120.0604;
          } else if (iso === '2021-02-22') {
            nav = 41.5242;
          } else if (iso < '2021-02-19') {
            const daysFromRef = Math.round(
              (Date.parse(`${iso}T00:00:00Z`) - Date.parse('2021-02-19T00:00:00Z')) / 86400000
            );
            nav = Number((4120.0604 * Math.pow(1.0002, daysFromRef)).toFixed(4));
          } else {
            const daysAfterRef = Math.round(
              (Date.parse(`${iso}T00:00:00Z`) - Date.parse('2021-02-22T00:00:00Z')) / 86400000
            );
            nav = Number((41.5242 * Math.pow(1.00025, daysAfterRef)).toFixed(4));
          }
          rows.push({ date: `${dd}-${mm}-${yyyy}`, nav: nav.toFixed(4) });
        }
        dt.setUTCDate(dt.getUTCDate() + 1);
      }
      return rows;
    }

    it('separates raw and 100:1 split-adjusted NAV histories for HDFC Gold ETF (113049), turning -98.99% break into +0.79%', () => {
      const rawRows = buildHdfcGoldEtfFixtureSeries();

      // 1. Without verified corporate actions, -98.99% break stays strictly quarantined
      const unadjusted = validateRawNavSeries(rawRows, {
        schemeCode: 113049,
        valuationCutoffDate: '2023-06-30',
        maxStaleDays: 14,
        corporateActions: [],
      });
      assert.equal(unadjusted.validation.quarantinedFromBreak, true);
      assert.equal(unadjusted.validation.status, 'quarantined_partial');
      assert.equal(unadjusted.validation.adjustedApplied, false);
      assert.equal(unadjusted.validation.corporateActionBreaks[0].pctChange, -98.99);

      // 2. With verified NSE Circular NSE/CML/47320 action, rawPoints preserved & adjustedPoints unblocked
      const splitValidated = validateRawNavSeries(rawRows, {
        schemeCode: 113049,
        valuationCutoffDate: '2023-06-30',
        maxStaleDays: 14,
        seriesIsin: 'INF179KC1981',
      });

      assert.equal(splitValidated.validation.usable, true);
      assert.equal(splitValidated.validation.status, 'valid');
      assert.equal(splitValidated.validation.quarantinedFromBreak, false);
      assert.equal(splitValidated.validation.adjustedApplied, true);
      assert.deepEqual(splitValidated.appliedActionIds, ['NSE-CML-47320-113049-SPLIT-100-1']);

      const rawMap = new Map((splitValidated.rawPoints || []).map((p) => [p.date, p.nav]));
      const adjMap = new Map((splitValidated.adjustedPoints || []).map((p) => [p.date, p.nav]));

      // Raw preserves unadjusted pre-split 4120.0604 -> post-split 41.5242 (-98.99%)
      assert.equal(rawMap.get('2021-02-19'), 4120.0604);
      assert.equal(rawMap.get('2021-02-22'), 41.5242);

      // Adjusted scales < 2021-02-22 by factor 100 -> 41.200604 -> 41.5242 (+0.79%)
      assert.equal(adjMap.get('2021-02-19'), 41.200604);
      assert.equal(adjMap.get('2021-02-22'), 41.5242);

      const appliedMeta = splitValidated.validation.appliedCorporateActions?.[0];
      assert.ok(appliedMeta);
      assert.equal(appliedMeta.actionId, 'NSE-CML-47320-113049-SPLIT-100-1');
      assert.equal(appliedMeta.factor, 100);
      assert.equal(appliedMeta.effectiveDate, '2021-02-22');
      assert.equal(appliedMeta.preActionIsin, 'INF179KC1981');
      assert.equal(appliedMeta.postActionIsin, 'INF179KC1981');
      assert.equal(appliedMeta.windowStatus, 'applied');
      assert.equal(appliedMeta.adjustedBoundaryReturnPct, 0.79);

      // Analytics across the split boundary now compute cleanly instead of returning -98.99% or quarantined null
      const trailing = computeTrailingCagrWithMeta(
        splitValidated.points,
        [1, 3],
        splitValidated.validation.corporateActionBreaks
      );
      assert.notEqual(trailing.values['1Y'], null);
      assert.notEqual(trailing.values['3Y'], null);
      assert.ok((trailing.values['3Y'] ?? -100) > -20);

      const roll1Y = computeRollingReturns(
        splitValidated.points,
        1.0,
        252,
        splitValidated.validation.corporateActionBreaks
      );
      assert.equal(roll1Y.available, true);
      assert.equal(roll1Y.quarantinedWindowsCount, 0);

      const sip = simulateMonthlySip(
        splitValidated.points,
        10000,
        2,
        splitValidated.validation.corporateActionBreaks
      );
      assert.equal(sip.available, true);

      // 3. Double-application idempotency: applying the same action again never divides twice
      const reapplied = applyCorporateActionsToSeries(
        splitValidated,
        VERIFIED_CORPORATE_ACTIONS[113049]
      );
      const reappliedAdjMap = new Map((reapplied.adjustedPoints || []).map((p) => [p.date, p.nav]));
      assert.equal(reappliedAdjMap.get('2021-02-19'), 41.200604);
      assert.equal(reappliedAdjMap.get('2021-02-22'), 41.5242);
      assert.deepEqual(reapplied.appliedActionIds, ['NSE-CML-47320-113049-SPLIT-100-1']);
    });

    it('handles out-of-window actions, split calendar gaps, nonpositive NAV pre-filtering, ISIN mismatches, unresolved breaks, and late revisions', async () => {
      // 1. Out-of-window action (post-split 2022-01-03..2023-06-30 only -> untouched post-split NAV)
      const postSplitOnly = generateTradingSeries('2022-01-03', 60, 48.0, 0.0004);
      const outOfWindowRes = validateRawNavSeries(postSplitOnly, {
        schemeCode: 113049,
        valuationCutoffDate: '2026-11-15',
        maxStaleDays: 3650,
        seriesIsin: 'INF179KC1981',
      });
      assert.equal(outOfWindowRes.validation.adjustedApplied, false);
      assert.equal(outOfWindowRes.points[0].nav, 48.0);
      assert.equal(outOfWindowRes.validation.appliedCorporateActions?.[0].windowStatus, 'out_of_window');

      // 2. Calendar gap across split boundary (missing 2021-02-19 and 2021-02-22; uses 2021-02-18 -> 2021-02-23)
      const gappedSplit = [
        { date: '18-02-2021', nav: '4115.0000' },
        { date: '23-02-2021', nav: '41.6000' },
        { date: '24-02-2021', nav: '41.7500' },
      ];
      const gappedRes = validateRawNavSeries(gappedSplit, {
        schemeCode: 113049,
        valuationCutoffDate: '2021-02-25',
        maxStaleDays: 14,
        seriesIsin: 'INF179KC1981',
      });
      assert.equal(gappedRes.validation.quarantinedFromBreak, false);
      assert.equal(gappedRes.points[0].nav, 41.15);
      assert.equal(gappedRes.points[1].nav, 41.6);

      // 3. Nonpositive NAVs pre-split rejected BEFORE split adjustment
      const withZeroPreSplit = [
        { date: '18-02-2021', nav: '0' },
        { date: '19-02-2021', nav: '4120.0604' },
        { date: '22-02-2021', nav: '41.5242' },
      ];
      const zeroFilteredRes = validateRawNavSeries(withZeroPreSplit, {
        schemeCode: 113049,
        valuationCutoffDate: '2021-02-25',
        seriesIsin: 'INF179KC1981',
      });
      assert.equal(zeroFilteredRes.validation.rejectedNonPositiveCount, 1);
      assert.equal(zeroFilteredRes.points.length, 2);
      assert.equal(zeroFilteredRes.points[0].date, '2021-02-19');

      // 4. Effective ISIN mismatch blocks corporate action & preserves quarantine
      const mismatchedIsinRes = validateRawNavSeries(
        [
          { date: '19-02-2021', nav: '4120.0604' },
          { date: '22-02-2021', nav: '41.5242' },
        ],
        {
          schemeCode: 113049,
          valuationCutoffDate: '2021-02-25',
          seriesIsin: 'INF999Z01999', // wrong ISIN!
        }
      );
      assert.equal(mismatchedIsinRes.validation.adjustedApplied, false);
      assert.equal(mismatchedIsinRes.validation.quarantinedFromBreak, true);
      assert.equal(
        mismatchedIsinRes.validation.appliedCorporateActions?.[0].windowStatus,
        'isin_mismatch_skipped'
      );

      // 5. Unresolved secondary break remains quarantined even when verified 2021 split applied
      const dualBreakActions: CorporateActionRecord[] = VERIFIED_CORPORATE_ACTIONS[113049];
      const dualBreakSeries = [
        { date: '19-02-2021', nav: '4120.0604' },
        { date: '22-02-2021', nav: '41.5242' },
        { date: '23-02-2021', nav: '41.8000' },
        { date: '24-02-2021', nav: '4.1800' }, // unverified 10:1 drop
      ];
      const dualRes = validateRawNavSeries(dualBreakSeries, {
        schemeCode: 113049,
        valuationCutoffDate: '2021-02-25',
        seriesIsin: 'INF179KC1981',
        corporateActions: dualBreakActions,
      });
      assert.equal(dualRes.validation.adjustedApplied, true);
      assert.equal(dualRes.validation.quarantinedFromBreak, true);
      assert.equal(dualRes.validation.corporateActionBreaks.length, 1);
      assert.equal(dualRes.validation.corporateActionBreaks[0].date, '2021-02-24');

      // 6. Late provider correction re-validation never double-adjusts
      const lateCorrectionRes = validateRawNavSeries(
        [
          { date: '19-02-2021', nav: '4120.1200' }, // revised by AMFI
          { date: '22-02-2021', nav: '41.5242' },
        ],
        {
          schemeCode: 113049,
          valuationCutoffDate: '2021-02-25',
          seriesIsin: 'INF179KC1981',
        }
      );
      assert.equal(lateCorrectionRes.rawPoints?.[0].nav, 4120.12);
      assert.equal(lateCorrectionRes.adjustedPoints?.[0].nav, 41.2012);

      // 7. Discovered scheme workflow acceptance (113049 verified via AMFI portal registry) & wrong-ISIN block
      const originalFetch = globalThis.fetch;
      try {
        const goodPayload = {
          meta: {
            scheme_code: 113049,
            scheme_name: 'HDFC Gold ETF - Growth Option',
            fund_house: 'HDFC Mutual Fund',
            scheme_category: 'Other Scheme - Gold ETF',
            scheme_type: 'Open Ended Schemes',
            isin_growth: 'INF179KC1981',
            isin_div_reinvestment: null,
          },
          data: [
            { date: '13-11-2026', nav: '115.4937' },
            { date: '22-02-2021', nav: '41.5242' },
            { date: '19-02-2021', nav: '4120.0604' },
          ],
          status: 'SUCCESS',
        };
        const addOk = await addSchemeWorkflow({
          requestedCode: 113049,
          selectedCodes: [122639],
          customFunds: {},
          validatedSeriesMap: {},
          valuationCutoffDate: '2026-11-15',
          fetchImpl: (async () => makeJsonResponse(goodPayload)) as typeof fetch,
        });
        assert.equal(addOk.ok, true);
        assert.equal(addOk.validatedSeries?.validation.adjustedApplied, true);
        assert.equal(addOk.validatedSeries?.rawPoints?.[0].nav, 4120.0604);
        assert.equal(addOk.validatedSeries?.adjustedPoints?.[0].nav, 41.200604);

        const prevBlockedWrongIsin = await previewSchemeWorkflow({
          requestedCode: 113049,
          expectedIsin: 'INF179KC9999',
          valuationCutoffDate: '2026-11-15',
          fetchImpl: (async () => makeJsonResponse(goodPayload)) as typeof fetch,
        });
        assert.equal(prevBlockedWrongIsin.accepted, false);
        assert.equal(prevBlockedWrongIsin.shouldCachePreview, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Part 3: Export Parity Across All 4 Exports (Benchmark Provenance, Roles & Split-Adjusted + Raw Series)', () => {
    it('exports full Batch 2 TRI provenance, scheme_default vs common_comparator roles, aligned window, and 113049 split raw+adjusted series', () => {
      const bmComparator = resolveVerifiedBenchmarkSeries('^CRSLDX', 'common_comparator');
      const bmDefaultMidcap = resolveVerifiedBenchmarkSeries('NIFTYMIDCAP150.NS', 'scheme_default');
      assert.equal(bmComparator.available, true);
      assert.equal(bmDefaultMidcap.available, true);

      const hdfcGoldFund: FundMeta = {
        scheme_code: 113049,
        name: 'HDFC Gold ETF - Growth Option',
        category: 'Gold & Precious Metals',
        asset_class: 'Commodity',
        fund_house: 'HDFC Mutual Fund',
        benchmark_symbol: 'GOLD_DOMESTIC',
        isin: 'INF179KC1981',
        plan: 'ETF',
        option: 'Growth',
        aum_cr: null,
        inception_date: '2010-08-13',
        expense_ratio_direct: null,
        expense_ratio_regular: null,
        turnover_ratio_pct: null,
        riskometer: 'High',
        exit_load: null,
        min_sip_inr: null,
        min_lumpsum_inr: null,
        investment_objective: null,
        manager: null,
        holdings: null,
        holdingsStatus: {
          available: false,
          asOfDate: null,
          source: null,
          partialCoverage: false,
          reason: 'Unavailable',
        },
        identityStatus: validateSchemeIdentity(
          {
            scheme_code: 113049,
            name: 'HDFC Gold ETF - Growth Option',
            plan: 'ETF',
            option: 'Growth',
            isin: 'INF179KC1981',
          },
          {
            scheme_code: 113049,
            scheme_name: 'HDFC Gold ETF - Growth Option',
            isin_growth: 'INF179KC1981',
          }
        ),
        disclosureSource: 'AMFI Historical NAV Report',
        asOfDate: '2026-11-13',
        isStatutoryDisclosure: true,
      };

      const moFund = PRESET_FUNDS[127042];
      // Build continuous aligned series for MO + 113049 spanning the split
      const goldRawRows: { date: string; nav: string }[] = [];
      const dt = new Date('2021-01-01T00:00:00Z');
      while (dt.toISOString().slice(0, 10) <= '2026-11-13') {
        const day = dt.getUTCDay();
        if (day !== 0 && day !== 6) {
          const iso = dt.toISOString().slice(0, 10);
          const dd = iso.slice(8, 10);
          const mm = iso.slice(5, 7);
          const yyyy = iso.slice(0, 4);
          const nav = iso < '2021-02-22' ? 4120.0604 : iso === '2021-02-22' ? 41.5242 : 42.0;
          goldRawRows.push({ date: `${dd}-${mm}-${yyyy}`, nav: nav.toFixed(4) });
        }
        dt.setUTCDate(dt.getUTCDate() + 1);
      }

      const goldVal = validateRawNavSeries(goldRawRows, {
        schemeCode: 113049,
        valuationCutoffDate: '2026-11-15',
        seriesIsin: 'INF179KC1981',
      });
      const moVal = validateMfapiPayload(
        127042,
        {
          meta: {
            scheme_code: 127042,
            scheme_name: 'Motilal Oswal Midcap Fund',
            isin_growth: 'INF247L01445',
          },
          data: generateTradingSeries('2025-10-01', 280, 110.0, 0.0005),
        },
        { valuationCutoffDate: '2026-11-15' }
      );

      const rmMo = computeComprehensiveMetrics(
        moVal.points,
        bmComparator.series,
        moFund.name,
        127042,
        moFund.category,
        moFund.asset_class,
        0.065,
        moVal.validation.corporateActionBreaks,
        { symbol: bmComparator.symbol, role: 'common_comparator' }
      );
      const rmGold = computeComprehensiveMetrics(
        goldVal.adjustedPoints || goldVal.points,
        bmComparator.series,
        hdfcGoldFund.name,
        113049,
        hdfcGoldFund.category,
        hdfcGoldFund.asset_class,
        0.065,
        goldVal.validation.corporateActionBreaks,
        { symbol: bmComparator.symbol, role: 'common_comparator' }
      );

      const exportInput: ExportBuilderInput = {
        selectedFunds: [moFund, hdfcGoldFund],
        riskMetrics: [rmMo, rmGold],
        trailingMetaMap: {
          127042: computeTrailingCagrWithMeta(moVal.points, [0.25, 0.5, 1]),
          113049: computeTrailingCagrWithMeta(
            goldVal.adjustedPoints || goldVal.points,
            [0.25, 0.5, 1, 3, 5],
            goldVal.validation.corporateActionBreaks
          ),
        },
        seriesMap: {
          127042: moVal.points,
          113049: goldVal.adjustedPoints || goldVal.points,
        },
        rawSeriesMap: {
          127042: moVal.rawPoints || moVal.points,
          113049: goldVal.rawPoints || goldVal.points,
        },
        validationMap: {
          127042: moVal.validation,
          113049: goldVal.validation,
        },
        identityMap: {
          127042: moVal.identity ?? moFund.identityStatus,
          113049: hdfcGoldFund.identityStatus,
        },
        benchmarkStatus: bmComparator,
        schemeDefaultBenchmarks: {
          127042: bmDefaultMidcap,
          113049: resolveVerifiedBenchmarkSeries('GOLD_DOMESTIC', 'scheme_default'),
        },
        rfRate: 6.5,
      };

      // 1. Comparison CSV
      const compCsv = buildComparisonCsv(exportInput);
      assert.match(compCsv, /ProviderID: NSEI:NIFTY500_TRI/);
      assert.match(compCsv, /NSEI:NIFTYMIDCAP150_TRI/);
      assert.match(compCsv, /NSE-CML-47320-113049-SPLIT-100-1/);
      assert.match(compCsv, /100:1@2021-02-22/);

      // 2. Complete Analytics JSON
      const jsonPkg = buildComparisonJsonPayload(exportInput);
      assert.equal(jsonPkg.metadata.benchmark.providerIndexId, 'NSEI:NIFTY500_TRI');
      assert.equal(jsonPkg.metadata.benchmark.role, 'common_comparator');
      assert.equal(jsonPkg.metadata.benchmark.variant, 'TRI');
      assert.equal(jsonPkg.metadata.benchmark.checksumSha256, bmComparator.checksumSha256);
      assert.equal(jsonPkg.metadata.benchmark.isTestFixture, false);

      assert.equal(jsonPkg.funds[0].schemeDefaultBenchmark.symbol, 'NIFTYMIDCAP150.NS');
      assert.equal(jsonPkg.funds[0].schemeDefaultBenchmark.role, 'scheme_default');
      assert.equal(jsonPkg.funds[0].schemeDefaultBenchmark.providerIndexId, 'NSEI:NIFTYMIDCAP150_TRI');
      assert.equal(jsonPkg.funds[0].schemeDefaultBenchmark.available, true);

      assert.equal(jsonPkg.funds[1].schemeDefaultBenchmark.symbol, 'GOLD_DOMESTIC');
      assert.equal(jsonPkg.funds[1].schemeDefaultBenchmark.available, false);
      assert.equal(jsonPkg.funds[1].corporateActions.adjustedApplied, true);
      assert.equal(
        jsonPkg.funds[1].corporateActions.appliedActions[0]?.actionId,
        'NSE-CML-47320-113049-SPLIT-100-1'
      );

      // 3. Single-Fund Factsheet CSV (HDFC Gold ETF)
      const factsheetCsv = buildSingleFundFactsheetCsv(hdfcGoldFund, exportInput);
      assert.match(factsheetCsv, /"Corporate Action Adjustment Applied","Yes"/);
      assert.match(factsheetCsv, /NSE-CML-47320-113049-SPLIT-100-1/);
      assert.match(factsheetCsv, /"Selected Common Comparator","Nifty 500 Total Returns Index \(TRI\)/);
      assert.match(factsheetCsv, /"Disclosed Default Benchmark","Domestic Gold Spot Index/);

      // 4. Raw Validated Daily NAV CSV (includes BOTH [Split-Adjusted] and [Raw Unadjusted] columns!)
      const rawNavCsv = buildRawNavCsv(exportInput);
      assert.match(rawNavCsv, /Benchmark_Nifty_500_Total_Returns_Index_TRI_TRI/);
      assert.match(rawNavCsv, /HDFC Gold ETF - Growth Option \(113049\) \[Split-Adjusted\]/);
      assert.match(rawNavCsv, /HDFC Gold ETF - Growth Option \(113049\) \[Raw Unadjusted\]/);
      assert.match(rawNavCsv, /2021-02-19,.*,41\.200604,4120\.0604/);
    });
  });
});
