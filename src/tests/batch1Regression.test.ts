/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRESET_FUNDS,
  fetchLiveMfNav,
  resolveBenchmarkSeries,
  validateMfapiPayload,
} from '../data/presetFunds';
import { FundHolding, FundMeta, NavPoint, TrailingCagrResult } from '../types/quant';
import { getIndiaValuationDateIso, validateRawNavSeries } from '../utils/navValidator';
import {
  aggregateMarketCapExposure,
  aggregateSectorExposure,
  computeComprehensiveMetrics,
  computeHoldingsCoverage,
  computeOverlapMatrix,
  computePairwiseOverlap,
  computePairwiseOverlapWithMeta,
  computeRollingReturns,
  computeTrailingCagrWithMeta,
} from '../utils/quantEngine';
import { TRUSTED_AMFI_REGISTRY, TrustedRegistryEntry } from '../utils/schemeIdentity';
import { addSchemeWorkflow, previewSchemeWorkflow } from '../utils/schemeWorkflow';
import {
  ExportBuilderInput,
  buildComparisonCsv,
  buildComparisonJsonPayload,
  buildRawNavCsv,
  buildSingleFundFactsheetCsv,
} from '../components/DataExportModal';

function makeJsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateTradingSeries(
  startIso: string,
  days: number,
  startNav: number = 100,
  dailyStep: number = 0.0005
): { date: string; nav: string }[] {
  const rows: { date: string; nav: string }[] = [];
  let nav = startNav;
  const dt = new Date(`${startIso}T00:00:00Z`);
  let produced = 0;
  while (produced < days) {
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = dt.getUTCFullYear();
      const wave = Math.sin(produced * 0.25) * 0.003;
      nav = nav * (1 + dailyStep + wave);
      rows.push({
        date: `${dd}-${mm}-${yyyy}`,
        nav: nav.toFixed(4),
      });
      produced++;
    }
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return rows.reverse();
}

describe('Batch 1 Regression Suite (MF-002, MF-006, MF-008, MF-007 & Invariants)', () => {
  describe('MF-002: Expected identity validation across Preview, Add, Selection & Caches', () => {
    it('rejects Preview and Add when requesting 147622 returns legitimate scheme 119092, leaving selection and caches untouched', async () => {
      const mismatchedPayload = {
        meta: {
          fund_house: 'DSP Mutual Fund',
          scheme_type: 'Open Ended Schemes',
          scheme_category: 'Equity Scheme - Mid Cap Fund',
          scheme_code: 119092,
          scheme_name: 'DSP Midcap Fund - Direct Plan - Growth',
          isin_growth: 'INF740K01PL7',
          isin_div_reinvestment: null,
        },
        data: generateTradingSeries('2026-09-01', 45, 145),
        status: 'SUCCESS',
      };

      const fetchStub: typeof fetch = async () => makeJsonResponse(mismatchedPayload);

      // 1) Preview path must reject with code_mismatch and refuse caching
      const previewRes = await previewSchemeWorkflow({
        requestedCode: 147622,
        expectedName: 'DSP Quant Fund - Direct Plan - Growth',
        expectedPlan: 'Direct',
        expectedOption: 'Growth',
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchStub,
      });

      assert.equal(previewRes.accepted, false);
      assert.equal(previewRes.shouldCachePreview, false);
      assert.equal(previewRes.analyticsSuppressed, true);
      assert.equal(previewRes.identity.status, 'code_mismatch');
      assert.equal(previewRes.identity.verified, false);
      assert.equal(previewRes.identity.scheme_code, 147622);
      assert.equal(previewRes.identity.providerSchemeCode, 119092);
      assert.equal(previewRes.latestNav, null);
      assert.equal(previewRes.latestDate, null);
      assert.match(previewRes.previewError || '', /mismatch/i);

      // 2) Add path must reject with code_mismatch and preserve initial references cleanly
      const initialSelected = [122639];
      const initialCustomFunds: Record<number, FundMeta> = {};
      const initialSeriesMap = {};

      const addRes = await addSchemeWorkflow({
        requestedCode: 147622,
        expectedName: 'DSP Quant Fund - Direct Plan - Growth',
        expectedPlan: 'Direct',
        expectedOption: 'Growth',
        selectedCodes: initialSelected,
        customFunds: initialCustomFunds,
        validatedSeriesMap: initialSeriesMap,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchStub,
      });

      assert.equal(addRes.ok, false);
      assert.match(addRes.message, /mismatch/i);
      assert.equal(addRes.fundMeta, null);
      assert.equal(addRes.validatedSeries?.identity?.status, 'code_mismatch');
      assert.equal(addRes.validatedSeries?.validation.usable, false);
      assert.equal(addRes.validatedSeries?.validation.validCount, 0);
      assert.strictEqual(addRes.nextSelectedCodes, initialSelected);
      assert.strictEqual(addRes.nextCustomFunds, initialCustomFunds);
      assert.strictEqual(addRes.nextValidatedSeriesMap, initialSeriesMap);
      assert.equal(addRes.nextSelectedCodes.includes(147622), false);
      assert.equal(addRes.nextSelectedCodes.includes(119092), false);
      assert.equal(147622 in addRes.nextValidatedSeriesMap, false);
      assert.equal(119092 in addRes.nextValidatedSeriesMap, false);
    });

    it('rejects wrong plan (Regular vs Direct) in Preview and Add against trusted registry', async () => {
      const testRegistry: Record<number, TrustedRegistryEntry> = {
        ...TRUSTED_AMFI_REGISTRY,
        147622: {
          scheme_code: 147622,
          scheme_name: 'DSP Quant Fund - Direct Plan - Growth',
          plan: 'Direct',
          option: 'Growth',
          isin: 'INF740K01QD2',
          asOfDate: '2026-11-13',
          source: 'amfi-test-fixture',
        },
      };

      const regularPayload = {
        meta: {
          fund_house: 'DSP Mutual Fund',
          scheme_category: 'Equity Scheme - Thematic',
          scheme_code: 147622,
          scheme_name: 'DSP Quant Fund - Regular Plan - Growth',
          isin_growth: 'INF740K01QD2',
        },
        data: generateTradingSeries('2026-09-01', 45, 22),
      };
      const fetchStub: typeof fetch = async () => makeJsonResponse(regularPayload);

      const previewRes = await previewSchemeWorkflow({
        requestedCode: 147622,
        expectedPlan: 'Direct',
        expectedOption: 'Growth',
        trustedRegistry: testRegistry,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchStub,
      });
      assert.equal(previewRes.accepted, false);
      assert.equal(previewRes.shouldCachePreview, false);
      assert.equal(previewRes.identity.status, 'plan_mismatch');

      const initialSelected = [122639];
      const initialCustomFunds: Record<number, FundMeta> = {};
      const initialSeriesMap = {};
      const addRes = await addSchemeWorkflow({
        requestedCode: 147622,
        expectedPlan: 'Regular',
        trustedRegistry: testRegistry,
        selectedCodes: initialSelected,
        customFunds: initialCustomFunds,
        validatedSeriesMap: initialSeriesMap,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchStub,
      });

      assert.equal(addRes.ok, false);
      assert.equal(addRes.validatedSeries?.identity?.status, 'plan_mismatch');
      assert.strictEqual(addRes.nextSelectedCodes, initialSelected);
      assert.strictEqual(addRes.nextCustomFunds, initialCustomFunds);
      assert.strictEqual(addRes.nextValidatedSeriesMap, initialSeriesMap);
    });

    it('rejects syntactically plausible fabricated ISIN and suppresses unverified discoveries absent from trusted registry', async () => {
      const fabricatedIsin = 'INF999Z01999';
      const testRegistry: Record<number, TrustedRegistryEntry> = {
        ...TRUSTED_AMFI_REGISTRY,
        147622: {
          scheme_code: 147622,
          scheme_name: 'DSP Quant Fund - Direct Plan - Growth',
          plan: 'Direct',
          option: 'Growth',
          isin: 'INF740K01QD2',
          asOfDate: '2026-11-13',
          source: 'amfi-test-fixture',
        },
      };

      // Case A: Registered scheme returns fabricated ISIN -> isin_mismatch
      const fabricatedPayload = {
        meta: {
          fund_house: 'DSP Mutual Fund',
          scheme_category: 'Equity Scheme - Thematic',
          scheme_code: 147622,
          scheme_name: 'DSP Quant Fund - Direct Plan - Growth',
          isin_growth: fabricatedIsin,
        },
        data: generateTradingSeries('2026-09-01', 45, 22),
      };
      const fetchFab: typeof fetch = async () => makeJsonResponse(fabricatedPayload);

      const previewFab = await previewSchemeWorkflow({
        requestedCode: 147622,
        trustedRegistry: testRegistry,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchFab,
      });
      assert.equal(previewFab.accepted, false);
      assert.equal(previewFab.shouldCachePreview, false);
      assert.equal(previewFab.identity.status, 'isin_mismatch');

      const addFab = await addSchemeWorkflow({
        requestedCode: 147622,
        trustedRegistry: testRegistry,
        selectedCodes: [122639],
        customFunds: {},
        validatedSeriesMap: {},
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchFab,
      });
      assert.equal(addFab.ok, false);
      assert.equal(addFab.validatedSeries?.identity?.status, 'isin_mismatch');

      // Case B: Discovery absent from trusted registry -> unverified_registry + analytics suppressed
      const unregisteredCode = 199888;
      const unregisteredPayload = {
        meta: {
          fund_house: 'Example AMC',
          scheme_category: 'Equity Scheme - Flexi Cap Fund',
          scheme_code: unregisteredCode,
          scheme_name: 'Example Flexi Cap Fund - Direct Plan - Growth',
          isin_growth: fabricatedIsin,
        },
        data: generateTradingSeries('2026-09-01', 45, 35),
      };
      const fetchUnreg: typeof fetch = async () => makeJsonResponse(unregisteredPayload);

      const previewUnreg = await previewSchemeWorkflow({
        requestedCode: unregisteredCode,
        trustedRegistry: TRUSTED_AMFI_REGISTRY,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchUnreg,
      });
      assert.equal(previewUnreg.accepted, false);
      assert.equal(previewUnreg.shouldCachePreview, false);
      assert.equal(previewUnreg.analyticsSuppressed, true);
      assert.equal(previewUnreg.identity.status, 'unverified_registry');
      assert.equal(previewUnreg.identity.verified, false);

      const addUnreg = await addSchemeWorkflow({
        requestedCode: unregisteredCode,
        trustedRegistry: TRUSTED_AMFI_REGISTRY,
        selectedCodes: [122639],
        customFunds: {},
        validatedSeriesMap: {},
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchUnreg,
      });
      assert.equal(addUnreg.ok, false);
      assert.equal(addUnreg.validatedSeries?.identity?.status, 'unverified_registry');
      assert.equal(addUnreg.nextSelectedCodes.includes(unregisteredCode), false);
    });

    it('accepts a discovered scheme matching the trusted dated registry and uses one agreed code across workflow and exports', async () => {
      const agreedCode = 147622;
      const testRegistry: Record<number, TrustedRegistryEntry> = {
        ...TRUSTED_AMFI_REGISTRY,
        [agreedCode]: {
          scheme_code: agreedCode,
          scheme_name: 'DSP Quant Fund - Direct Plan - Growth',
          plan: 'Direct',
          option: 'Growth',
          isin: 'INF740K01QD2',
          asOfDate: '2026-11-13',
          source: 'amfi-test-fixture',
        },
      };

      const validPayload = {
        meta: {
          fund_house: 'DSP Mutual Fund',
          scheme_category: 'Equity Scheme - Thematic',
          scheme_code: agreedCode,
          scheme_name: 'DSP Quant Fund - Direct Plan - Growth',
          isin_growth: 'INF740K01QD2',
        },
        data: generateTradingSeries('2026-09-01', 45, 25),
      };
      const fetchOk: typeof fetch = async () => makeJsonResponse(validPayload);

      const previewOk = await previewSchemeWorkflow({
        requestedCode: agreedCode,
        expectedPlan: 'Direct',
        expectedOption: 'Growth',
        expectedIsin: 'INF740K01QD2',
        trustedRegistry: testRegistry,
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchOk,
      });
      assert.equal(previewOk.accepted, true);
      assert.equal(previewOk.shouldCachePreview, true);
      assert.equal(previewOk.analyticsSuppressed, false);
      assert.equal(previewOk.scheme_code, agreedCode);
      assert.equal(previewOk.identity.verified, true);
      assert.equal(previewOk.identity.registryMatched, true);

      const addOk = await addSchemeWorkflow({
        requestedCode: agreedCode,
        expectedPlan: 'Direct',
        expectedOption: 'Growth',
        expectedIsin: 'INF740K01QD2',
        trustedRegistry: testRegistry,
        selectedCodes: [],
        customFunds: {},
        validatedSeriesMap: {},
        valuationCutoffDate: '2026-11-15',
        fetchImpl: fetchOk,
      });
      assert.equal(addOk.ok, true);
      assert.equal(addOk.fundMeta?.scheme_code, agreedCode);
      assert.equal(addOk.validatedSeries?.schemeCode, agreedCode);
      assert.deepEqual(addOk.nextSelectedCodes, [agreedCode]);
    });
  });

  describe('MF-006: Registry vs fetched identity & non-polluting failure diagnostics across UI and all 4 exports', () => {
    it('fixture 122639 receives 127042: exposes mismatch across all 4 exports and leaks zero MO dates or counts', () => {
      const ppfas = PRESET_FUNDS[122639];
      const moSeries = generateTradingSeries('2026-09-01', 50, 118);

      const pollutedPayload = {
        meta: {
          fund_house: 'Motilal Oswal AMC',
          scheme_type: 'Open Ended Schemes',
          scheme_category: 'Equity Scheme - Mid Cap Fund',
          scheme_code: 127042,
          scheme_name: 'Motilal Oswal Midcap Fund',
          isin_growth: 'INF247L01445',
        },
        data: moSeries,
      };

      const validated = validateMfapiPayload(122639, pollutedPayload, {
        requestedCode: 122639,
        valuationCutoffDate: '2026-11-15',
      });

      assert.equal(validated.identity?.verified, false);
      assert.equal(validated.identity?.status, 'code_mismatch');
      assert.equal(validated.identity?.registrySchemeCode, 122639);
      assert.equal(validated.identity?.providerSchemeCode, 127042);
      assert.equal(validated.validation.usable, false);
      assert.equal(validated.validation.validCount, 0);
      assert.equal(validated.validation.earliestDate, null);
      assert.equal(validated.validation.latestDate, null);
      assert.equal(validated.points.length, 0);
      assert.equal(validated.validation.rejectedPayloadDiagnostics?.requestedSchemeCode, 122639);
      assert.equal(validated.validation.rejectedPayloadDiagnostics?.returnedSchemeCode, 127042);
      assert.equal(validated.validation.rejectedPayloadDiagnostics?.totalRawCount, 50);

      const benchmarkStatus = resolveBenchmarkSeries(ppfas.benchmark_symbol);
      const exportInput: ExportBuilderInput = {
        selectedFunds: [ppfas],
        riskMetrics: [
          computeComprehensiveMetrics(
            validated.points,
            benchmarkStatus.series,
            ppfas.name,
            ppfas.scheme_code,
            ppfas.category,
            ppfas.asset_class,
            0.065,
            validated.validation.corporateActionBreaks
          ),
        ],
        trailingMetaMap: {
          122639: computeTrailingCagrWithMeta(
            validated.points,
            [0.25, 0.5, 1, 3, 5, 7, 10],
            validated.validation.corporateActionBreaks
          ),
        },
        seriesMap: { 122639: validated.points },
        validationMap: { 122639: validated.validation },
        identityMap: { 122639: validated.identity ?? ppfas.identityStatus },
        benchmarkStatus,
        rfRate: 6.5,
        exportTimestamp: '2026-11-15T12:00:00.000Z',
      };

      // 1. Comparison CSV
      const parseCsvRow = (line: string): string[] => {
        const out: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"' && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else if (ch === '"') {
              inQ = false;
            } else {
              cur += ch;
            }
          } else if (ch === '"') {
            inQ = true;
          } else if (ch === ',') {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
        out.push(cur);
        return out;
      };
      const compCsv = buildComparisonCsv(exportInput);
      const compLines = compCsv.split('\n').filter((l) => !l.startsWith('#'));
      assert.equal(compLines.length, 2);
      const compHeaders = parseCsvRow(compLines[0]);
      const compCols = parseCsvRow(compLines[1]);
      const colVal = (name: string) => compCols[compHeaders.indexOf(name)];
      assert.equal(colVal('Scheme Code'), '122639');
      assert.equal(colVal('Registry Scheme Code'), '122639');
      assert.equal(colVal('Fetched Scheme Code'), '127042');
      assert.equal(colVal('Effective Identity Status'), 'code_mismatch');
      assert.equal(colVal('Rejected Payload Returned Code'), '127042');
      assert.equal(colVal('Rejected Payload Obs Count'), '50');
      assert.equal(colVal('Validated Window Start'), 'Unavailable');
      assert.equal(colVal('Validated Window End'), 'Unavailable');
      assert.equal(colVal('NAV Observations'), '0');
      assert.equal(colVal('1Y CAGR (%)'), 'Unavailable');
      assert.equal(colVal('Sharpe Ratio'), 'Unavailable');

      // 2. Analytics JSON
      const jsonPkg = buildComparisonJsonPayload(exportInput);
      const jsonFund = jsonPkg.funds[0];
      assert.equal(jsonFund.usable, false);
      assert.equal(jsonFund.effectiveIdentity.status, 'code_mismatch');
      assert.equal(jsonFund.effectiveIdentity.registrySchemeCode, 122639);
      assert.equal(jsonFund.effectiveIdentity.providerSchemeCode, 127042);
      assert.equal(jsonFund.navValidation?.validCount, 0);
      assert.equal(jsonFund.navValidation?.earliestDate, null);
      assert.equal(jsonFund.navValidation?.latestDate, null);
      assert.equal(jsonFund.navValidation?.rejectedPayloadDiagnostics?.returnedSchemeCode, 127042);
      assert.equal(jsonFund.navValidation?.rejectedPayloadDiagnostics?.totalRawCount, 50);
      assert.equal(jsonFund.riskMetrics, null);
      assert.deepEqual(jsonFund.trailingReturns, {});

      // 3. Single-Fund Factsheet CSV
      const singleCsv = buildSingleFundFactsheetCsv(ppfas, exportInput);
      assert.match(singleCsv, /"Registry Scheme Code",122639/);
      assert.match(singleCsv, /"Fetched Scheme Code",127042/);
      assert.match(singleCsv, /"Effective Identity Status","code_mismatch"/);
      assert.match(singleCsv, /"NAV Validation Window","Unavailable"/);
      assert.match(singleCsv, /"Validated NAV Observations",0/);
      assert.match(singleCsv, /"Rejected Payload Diagnostics","Requested 122639, Returned 127042 \(50 raw obs\)/);
      assert.match(singleCsv, /"1 Year \(CAGR\)","Unavailable"/);
      assert.match(singleCsv, /"Sharpe Ratio","Unavailable"/);

      // 4. Raw Validated NAV CSV
      const rawNavCsv = buildRawNavCsv(exportInput);
      assert.match(rawNavCsv, /# SCHEME_VALIDATION_STATUS:/);
      assert.match(rawNavCsv, /FailureReason: Scheme code mismatch/);
      assert.match(rawNavCsv, /Diagnostics: requested=122639, returned=127042, rawRejectedObs=50/);
      assert.match(rawNavCsv, /# Total Validated Trading Dates: 0/);
      assert.match(rawNavCsv, /\[Unavailable: Scheme code mismatch/);
      const rawDataRows = rawNavCsv.split('\n').filter((l) => l && !l.startsWith('#'));
      assert.equal(rawDataRows.length, 1); // header only, zero leaked MO dates
    });

    it('exposes stale and unavailable responses cleanly across all 4 exports with zero leaked dates/counts', async () => {
      const ppfas = PRESET_FUNDS[122639];
      const staleValidated = validateMfapiPayload(
        122639,
        {
          meta: {
            scheme_code: 122639,
            scheme_name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
            isin_growth: 'INF879O01027',
          },
          data: [
            { date: '15-10-2026', nav: '91.1000' },
            { date: '14-10-2026', nav: '90.9500' },
          ],
        },
        { valuationCutoffDate: '2026-11-15', maxStaleDays: 14 }
      );

      assert.equal(staleValidated.validation.status, 'stale');
      assert.equal(staleValidated.validation.usable, false);
      assert.equal(staleValidated.validation.validCount, 0);
      assert.equal(staleValidated.validation.earliestDate, null);
      assert.equal(staleValidated.validation.latestDate, null);
      assert.equal(staleValidated.validation.rejectedPayloadDiagnostics?.totalRawCount, 2);

      const originalFetch = globalThis.fetch;
      let unavailableValidated;
      try {
        globalThis.fetch = (async () => makeJsonResponse({ message: 'Upstream failure' }, 503)) as typeof fetch;
        unavailableValidated = await fetchLiveMfNav(127042, { valuationCutoffDate: '2026-11-15' });
      } finally {
        globalThis.fetch = originalFetch;
      }

      assert.equal(unavailableValidated.validation.status, 'unavailable');
      assert.equal(unavailableValidated.validation.usable, false);
      assert.equal(unavailableValidated.validation.validCount, 0);
      assert.match(unavailableValidated.validation.unavailableReason || '', /503|Unavailable/);

      const mo = PRESET_FUNDS[127042];
      const benchmarkStatus = resolveBenchmarkSeries('^CRSLDX');
      const input: ExportBuilderInput = {
        selectedFunds: [ppfas, mo],
        riskMetrics: [],
        trailingMetaMap: {
          122639: { values: {}, unavailableReasons: {} },
          127042: { values: {}, unavailableReasons: {} },
        },
        seriesMap: { 122639: [], 127042: [] },
        validationMap: {
          122639: staleValidated.validation,
          127042: unavailableValidated.validation,
        },
        identityMap: {
          122639: staleValidated.identity ?? ppfas.identityStatus,
          127042: unavailableValidated.identity ?? mo.identityStatus,
        },
        benchmarkStatus,
        rfRate: 6.5,
      };

      const compCsv = buildComparisonCsv(input);
      const compRows = compCsv.split('\n').filter((l) => !l.startsWith('#'));
      assert.equal(compRows.length, 3);
      assert.match(compRows[1], /"stale"/);
      assert.match(compRows[1], /Stale NAV series/);
      assert.match(compRows[1], /"Unavailable","Unavailable",0,/);
      assert.match(compRows[2], /"provider_error"/);
      assert.match(compRows[2], /"Unavailable","Unavailable",0,/);

      const jsonPkg = buildComparisonJsonPayload(input);
      assert.equal(jsonPkg.funds[0].usable, false);
      assert.equal(jsonPkg.funds[0].effectiveIdentity.status, 'stale');
      assert.equal(jsonPkg.funds[0].navValidation?.validCount, 0);
      assert.equal(jsonPkg.funds[0].navValidation?.earliestDate, null);
      assert.equal(jsonPkg.funds[0].navValidation?.latestDate, null);
      assert.equal(jsonPkg.funds[1].usable, false);
      assert.equal(jsonPkg.funds[1].effectiveIdentity.status, 'provider_error');
      assert.equal(jsonPkg.funds[1].navValidation?.validCount, 0);

      const singleStaleCsv = buildSingleFundFactsheetCsv(ppfas, input);
      assert.match(singleStaleCsv, /"Effective Identity Status","stale"/);
      assert.match(singleStaleCsv, /"NAV Validation Window","Unavailable"/);
      assert.match(singleStaleCsv, /"Validated NAV Observations",0/);

      const rawNavCsv = buildRawNavCsv(input);
      assert.match(rawNavCsv, /Scheme 122639.*Status: stale.*FailureReason: Stale NAV series/);
      assert.match(rawNavCsv, /Scheme 127042.*Status: unavailable.*FailureReason: Unavailable/);
      const rawNavDataLines = rawNavCsv.split('\n').filter((l) => l && !l.startsWith('#'));
      assert.equal(rawNavDataLines.length, 1); // header only, zero data rows emitted
      assert.match(rawNavDataLines[0], /\[Unavailable: Stale NAV series/);
    });
  });

  describe('MF-008: India Valuation Cutoff enforcement', () => {
    it('computes Asia/Kolkata valuation date accurately around UTC day boundary', () => {
      // 2026-11-15 19:00:00 UTC is 2026-11-16 00:30:00 IST
      assert.equal(getIndiaValuationDateIso(new Date('2026-11-15T19:00:00Z')), '2026-11-16');
      // 2026-11-15 18:00:00 UTC is 2026-11-15 23:30:00 IST
      assert.equal(getIndiaValuationDateIso(new Date('2026-11-15T18:00:00Z')), '2026-11-15');
    });

    it('rejects a single 2026-11-16 row against explicit cutoff 2026-11-15', () => {
      const res = validateRawNavSeries([{ date: '16-11-2026', nav: '95.1200' }], {
        schemeCode: 122639,
        valuationCutoffDate: '2026-11-15',
      });

      assert.equal(res.validation.usable, false);
      assert.equal(res.validation.valuationCutoffDate, '2026-11-15');
      assert.equal(res.validation.rejectedPostCutoffCount, 1);
      assert.equal(res.validation.validCount, 0);
      assert.equal(res.rawObservations[0].status, 'post_cutoff_nav');
      assert.match(res.validation.unavailableReason || '', /post-cutoff/i);
    });

    it('keeps valid 2026-11-13 row in mixed series while rejecting post-cutoff 2026-11-16 row', () => {
      const res = validateRawNavSeries(
        [
          { date: '16-11-2026', nav: '95.1200' },
          { date: '13-11-2026', nav: '94.2594' },
        ],
        {
          schemeCode: 122639,
          valuationCutoffDate: '2026-11-15',
          maxStaleDays: 14,
        }
      );

      assert.equal(res.validation.usable, true);
      assert.equal(res.validation.status, 'valid');
      assert.equal(res.validation.rejectedPostCutoffCount, 1);
      assert.equal(res.validation.validCount, 1);
      assert.equal(res.validation.latestDate, '2026-11-13');
      assert.equal(res.validation.staleDays, 2);
      assert.deepEqual(res.points, [{ date: '2026-11-13', nav: 94.2594 }]);
    });

    it('ensures adding a future 2026-11-16 row cannot mask a stale 2026-10-01 series', () => {
      const res = validateRawNavSeries(
        [
          { date: '16-11-2026', nav: '99.9999' },
          { date: '01-10-2026', nav: '90.0000' },
        ],
        {
          schemeCode: 122639,
          valuationCutoffDate: '2026-11-15',
          maxStaleDays: 14,
        }
      );

      assert.equal(res.validation.usable, false);
      assert.equal(res.validation.status, 'stale');
      assert.equal(res.validation.isStale, true);
      assert.equal(res.validation.staleDays, 45);
      assert.equal(res.validation.rejectedPostCutoffCount, 1);
      assert.equal(res.validation.validCount, 0);
      assert.equal(res.validation.earliestDate, null);
      assert.equal(res.validation.latestDate, null);
      assert.equal(res.points.length, 0);
      assert.match(res.validation.unavailableReason || '', /Stale NAV series/);
    });
  });

  describe('MF-007: Holdings coverage preservation & covered-subset labeling', () => {
    it('suppresses exact overlap and exposes disclosed/unknown coverage for PPFAS (67.92%) & MO Midcap (62.70%)', () => {
      const ppfas = PRESET_FUNDS[122639];
      const mo = PRESET_FUNDS[127042];

      const covP = computeHoldingsCoverage(ppfas.holdings, ppfas.holdingsStatus.partialCoverage);
      const covM = computeHoldingsCoverage(mo.holdings, mo.holdingsStatus.partialCoverage);
      assert.equal(covP.disclosedWeightPct, 67.92);
      assert.equal(covP.unknownWeightPct, 32.08);
      assert.equal(covP.isComplete, false);
      assert.equal(covM.disclosedWeightPct, 62.7);
      assert.equal(covM.unknownWeightPct, 37.3);
      assert.equal(covM.isComplete, false);

      const pairMeta = computePairwiseOverlapWithMeta(
        ppfas.holdings,
        mo.holdings,
        true,
        ppfas.holdingsStatus.partialCoverage,
        mo.holdingsStatus.partialCoverage
      );
      assert.equal(pairMeta.exactOverlap, null);
      assert.equal(pairMeta.observedSubsetOverlap, 0);
      assert.equal(pairMeta.coverageStatus, 'partial_subset');
      assert.equal(
        computePairwiseOverlap(
          ppfas.holdings,
          mo.holdings,
          true,
          ppfas.holdingsStatus.partialCoverage,
          mo.holdingsStatus.partialCoverage
        ),
        null
      );

      const matrixRes = computeOverlapMatrix([
        {
          scheme_code: ppfas.scheme_code,
          name: ppfas.name,
          holdings: ppfas.holdings,
          partialCoverage: ppfas.holdingsStatus.partialCoverage,
        },
        {
          scheme_code: mo.scheme_code,
          name: mo.name,
          holdings: mo.holdings,
          partialCoverage: mo.holdingsStatus.partialCoverage,
        },
      ]);
      assert.equal(matrixRes.available, true);
      assert.equal(matrixRes.exactAvailable, false);
      assert.equal(matrixRes.matrix[0][1], null);
      assert.equal(matrixRes.matrix[1][0], null);
      assert.equal(matrixRes.observedSubsetMatrix[0][1], 0);
      assert.deepEqual(matrixRes.coveragePctByFund, [67.92, 62.7]);
      assert.deepEqual(matrixRes.unknownPctByFund, [32.08, 37.3]);
      assert.deepEqual(matrixRes.coverageStatusByFund, ['partial', 'partial']);

      const capExp = aggregateMarketCapExposure([
        { holdings: ppfas.holdings, partialCoverage: ppfas.holdingsStatus.partialCoverage },
        { holdings: mo.holdings, partialCoverage: mo.holdingsStatus.partialCoverage },
      ]);
      assert.equal(capExp.available, true);
      assert.equal(capExp.exactAvailable, false);
      assert.equal(capExp.isPartialSubset, true);
      assert.equal(capExp.coveredWeightPct, 65.31);
      assert.equal(capExp.unknownWeightPct, 34.69);
      const unknownCapSeg = capExp.segments.find((s) => s.segment === 'Unknown / Undisclosed');
      assert.ok(unknownCapSeg);
      assert.equal(unknownCapSeg.weight, 34.69);

      const sectorExp = aggregateSectorExposure([
        { holdings: ppfas.holdings, partialCoverage: ppfas.holdingsStatus.partialCoverage },
        { holdings: mo.holdings, partialCoverage: mo.holdingsStatus.partialCoverage },
      ]);
      assert.equal(sectorExp.available, true);
      assert.equal(sectorExp.exactAvailable, false);
      assert.equal(sectorExp.isPartialSubset, true);
      const unknownSector = sectorExp.sectors.find((s) => s.sector === 'Unknown / Undisclosed');
      assert.ok(unknownSector);
      assert.equal(unknownSector.weight, 34.69);
    });

    it('preserves genuine numeric 0 overlap for complete (>=95%) disjoint portfolios and excludes CASH/TREPS', () => {
      const completeA: FundHolding[] = [
        { isin: 'INE001A01001', name: 'Stock A1', sector: 'Technology', mcap: 'Large Cap', weight: 50, adtv_cr: 100 },
        { isin: 'INE001A01002', name: 'Stock A2', sector: 'Financial Services', mcap: 'Large Cap', weight: 46, adtv_cr: 100 },
        { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 4, adtv_cr: null },
      ];
      const completeB: FundHolding[] = [
        { isin: 'INE002B01001', name: 'Stock B1', sector: 'Healthcare', mcap: 'Mid Cap', weight: 60, adtv_cr: 80 },
        { isin: 'INE002B01002', name: 'Stock B2', sector: 'Industrials', mcap: 'Mid Cap', weight: 37, adtv_cr: 80 },
        { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 3, adtv_cr: null },
      ];

      const pairMeta = computePairwiseOverlapWithMeta(completeA, completeB, true, false, false);
      assert.equal(pairMeta.coverageStatus, 'complete');
      assert.equal(pairMeta.exactOverlap, 0);
      assert.equal(pairMeta.observedSubsetOverlap, 0);
      assert.equal(computePairwiseOverlap(completeA, completeB, true, false, false), 0);

      const mat = computeOverlapMatrix([
        { scheme_code: 1, name: 'Complete A', holdings: completeA, partialCoverage: false },
        { scheme_code: 2, name: 'Complete B', holdings: completeB, partialCoverage: false },
      ]);
      assert.equal(mat.exactAvailable, true);
      assert.equal(mat.matrix[0][1], 0);
      assert.equal(mat.matrix[1][0], 0);
      assert.equal(mat.matrix[0][0], 100);
    });
  });

  describe('Batch 1 Invariants: Benchmark Suppression & Corporate Action Quarantine', () => {
    it('keeps unverified benchmark suppressed while preserving validated fund-only risk metrics', () => {
      const bm = resolveBenchmarkSeries('^CRSLDX');
      assert.equal(bm.available, false);
      assert.equal(bm.variant, 'Unavailable');
      assert.equal(bm.series.length, 0);

      const raw = generateTradingSeries('2026-05-01', 138, 100, 0.0006);
      const val = validateRawNavSeries(raw, {
        schemeCode: 122639,
        valuationCutoffDate: '2026-11-15',
      });
      const rm = computeComprehensiveMetrics(
        val.points,
        bm.series,
        'Parag Parikh Flexi Cap Fund',
        122639,
        'Flexi Cap',
        'Equity'
      );
      assert.equal(rm.fundOnlyAvailable, true);
      assert.notEqual(rm.sharpe, null);
      assert.notEqual(rm.maxDrawdown, null);
      assert.equal(rm.benchmarkRelativeAvailable, false);
      assert.equal(rm.beta, null);
      assert.equal(rm.jensensAlpha, null);
      assert.equal(rm.trackingError, null);
    });

    it('quarantines single-session corporate action break (e.g. 100:1 split) in trailing and rolling windows', () => {
      const splitSeries: NavPoint[] = [];
      const dt = new Date('2020-01-01T00:00:00Z');
      for (let i = 0; i < 550; i++) {
        const iso = dt.toISOString().slice(0, 10);
        const nav = iso < '2021-02-22' ? 4100 + i * 0.5 : 41.5 + (i - 418) * 0.1;
        splitSeries.push({ date: iso, nav: Number(nav.toFixed(4)) });
        dt.setUTCDate(dt.getUTCDate() + 1);
      }
      const trailing = computeTrailingCagrWithMeta(splitSeries, [0.25, 1]);
      assert.notEqual(trailing.values['3M'], null);
      assert.equal(trailing.values['1Y'], null);
      assert.match(trailing.unavailableReasons['1Y'] || '', /corporate-action/i);

      const roll1Y = computeRollingReturns(splitSeries, 1.0, 252);
      assert.ok((roll1Y.quarantinedWindowsCount ?? 0) > 0);

      const roll2Y = computeRollingReturns(splitSeries, 2.0, 252);
      assert.equal(roll2Y.available, false);
      assert.ok((roll2Y.quarantinedWindowsCount ?? 0) > 0);
    });
  });
});
