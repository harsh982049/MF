import React, { useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Check, Database, Sparkles, ChevronDown } from 'lucide-react';
import {
  BenchmarkStatus,
  FundMeta,
  NavPoint,
  NavValidationReport,
  OverlapMatrixResult,
  RiskMetrics,
  SchemeIdentityAudit,
  TrailingCagrResult,
} from '../types/quant';
import {
  computeHoldingsCoverage,
  computeRollingReturns,
  computeBenchmarkHitRate,
  FULL_HOLDINGS_COVERAGE_THRESHOLD_PCT,
} from '../utils/quantEngine';
import { getIndiaValuationDateIso } from '../utils/navValidator';
import { AMFI_SNAPSHOT_DATE } from '../utils/schemeIdentity';

export interface ExportBuilderInput {
  selectedFunds: FundMeta[];
  riskMetrics: RiskMetrics[];
  trailingMetaMap: Record<number, TrailingCagrResult>;
  seriesMap: Record<number, NavPoint[]>;
  validationMap: Record<number, NavValidationReport | undefined>;
  identityMap?: Record<number, SchemeIdentityAudit | undefined>;
  holdingsOverlap?: OverlapMatrixResult;
  benchmarkStatus: BenchmarkStatus;
  rfRate: number;
  exportTimestamp?: string;
}

const sanitizeFilenamePart = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');

const csvText = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '"Unavailable"';
  const raw = String(value);
  const formulaPrefix = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaPrefix.replace(/"/g, '""')}"`;
};

const csvNum = (value: number | null | undefined, suffix: string = ''): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '"Unavailable"';
  return suffix ? `"${value}${suffix}"` : String(value);
};

interface EffectiveExportFundState {
  effectiveIdentity: SchemeIdentityAudit;
  usable: boolean;
  failureReason: string | null;
  effectiveSeries: NavPoint[];
  validCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  valuationCutoffDate: string;
  rejectedPostCutoffCount: number;
}

function resolveEffectiveFundState(
  fund: FundMeta,
  valReport: NavValidationReport | undefined,
  runtimeIdentity: SchemeIdentityAudit | undefined,
  rawSeries: NavPoint[]
): EffectiveExportFundState {
  const baseIdentity = runtimeIdentity ?? fund.identityStatus;
  const cutoffDate = valReport?.valuationCutoffDate || getIndiaValuationDateIso();
  const rejectedPostCutoffCount = valReport?.rejectedPostCutoffCount ?? 0;

  let effectiveIdentity: SchemeIdentityAudit = baseIdentity;
  if (
    valReport &&
    !valReport.usable &&
    valReport.status === 'stale' &&
    effectiveIdentity.verified
  ) {
    effectiveIdentity = {
      ...baseIdentity,
      verified: false,
      status: 'stale',
      reason: valReport.unavailableReason || baseIdentity.reason,
    };
  } else if (
    valReport?.rejectedPayloadDiagnostics &&
    effectiveIdentity.verified &&
    !valReport.usable
  ) {
    const diag = valReport.rejectedPayloadDiagnostics;
    const isCodeMismatch =
      diag.returnedSchemeCode !== null && diag.returnedSchemeCode !== fund.scheme_code;
    effectiveIdentity = {
      ...baseIdentity,
      verified: false,
      status: isCodeMismatch ? 'code_mismatch' : 'provider_error',
      registryMatched: false,
      providerSchemeCode: diag.returnedSchemeCode,
      providerName: diag.returnedSchemeName,
      providerIsin: diag.returnedIsin,
      reason: diag.reason,
    };
  }

  const usable = Boolean(effectiveIdentity.verified && valReport?.usable);
  const failureReason = !usable
    ? valReport?.unavailableReason ||
      effectiveIdentity.reason ||
      'Validated NAV series unavailable.'
    : null;

  return {
    effectiveIdentity,
    usable,
    failureReason,
    effectiveSeries: usable ? rawSeries : [],
    validCount: usable ? valReport?.validCount ?? rawSeries.length : 0,
    earliestDate: usable ? valReport?.earliestDate ?? null : null,
    latestDate: usable ? valReport?.latestDate ?? null : null,
    valuationCutoffDate: cutoffDate,
    rejectedPostCutoffCount,
  };
}

const getRollingAnalyticsForFund = (
  series: NavPoint[],
  validation: NavValidationReport | undefined,
  benchmarkStatus: BenchmarkStatus
) => {
  const breaks = validation?.corporateActionBreaks;
  const r1 = computeRollingReturns(series, 1.0, 252, breaks);
  const r3 = computeRollingReturns(series, 3.0, 252, breaks);
  const r5 = computeRollingReturns(series, 5.0, 252, breaks);
  const r7 = computeRollingReturns(series, 7.0, 252, breaks);

  const bSeries = benchmarkStatus.available ? benchmarkStatus.series : [];
  const b1 = computeRollingReturns(bSeries, 1.0);
  const b3 = computeRollingReturns(bSeries, 3.0);
  const b5 = computeRollingReturns(bSeries, 5.0);
  const b7 = computeRollingReturns(bSeries, 7.0);

  return {
    r1,
    r3,
    r5,
    r7,
    hit1: benchmarkStatus.available ? computeBenchmarkHitRate(r1.series, b1.series) : null,
    hit3: benchmarkStatus.available ? computeBenchmarkHitRate(r3.series, b3.series) : null,
    hit5: benchmarkStatus.available ? computeBenchmarkHitRate(r5.series, b5.series) : null,
    hit7: benchmarkStatus.available ? computeBenchmarkHitRate(r7.series, b7.series) : null,
  };
};

export function buildComparisonCsv(input: ExportBuilderInput): string {
  const {
    selectedFunds,
    riskMetrics,
    trailingMetaMap,
    seriesMap,
    validationMap,
    identityMap,
    benchmarkStatus,
    rfRate,
    exportTimestamp = new Date().toISOString(),
  } = input;

  const provenance = [
    `# Data Provenance: Indian Mutual Funds Quantitative & Risk Analytics Studio (Batch 1 Safe Export)`,
    `# NAV Feed Provider: mfapi.in (third-party historical NAV mirror; strictly validated)`,
    `# Identity Registry Benchmark: AMFI India NAVAll Snapshot (${AMFI_SNAPSHOT_DATE})`,
    `# Selected Benchmark: ${benchmarkStatus.name} (${benchmarkStatus.symbol}) | Variant: ${benchmarkStatus.variant} | Status: ${benchmarkStatus.available ? `Verified (${benchmarkStatus.source}, as of ${benchmarkStatus.asOfDate})` : `Unavailable (${benchmarkStatus.reason})`}`,
    `# Risk-Free Rate Applied: ${rfRate.toFixed(2)}% Annualized`,
    `# Export Timestamp: ${exportTimestamp}`,
    `#`,
  ];

  const headers = [
    'Scheme Code',
    'Scheme Name',
    'Registry Scheme Code',
    'Registry Name',
    'Registry ISIN',
    'Registry Matched',
    'Fetched Scheme Code',
    'Fetched Name',
    'Fetched ISIN',
    'Effective Identity Status',
    'Failure / Identity Reason',
    'NAV Validation Status',
    'Valuation Cutoff Date',
    'Rejected Post-Cutoff Count',
    'Rejected Payload Returned Code',
    'Rejected Payload Obs Count',
    'Rejected Payload Reason',
    'Corporate Action Quarantine',
    'Validated Window Start',
    'Validated Window End',
    'NAV Observations',
    'Holdings Coverage Status',
    'Holdings Disclosed (%)',
    'Holdings Unknown (%)',
    'ISIN',
    'Plan',
    'Option',
    'Category',
    'Asset Class',
    'Fund House',
    'Target Benchmark',
    'Benchmark Source Status',
    'Rf Applied (%)',
    'AUM (Cr INR)',
    'Direct TER (%)',
    'Turnover (%)',
    'Riskometer',
    'Inception Date',
    'Manager Name',
    'Manager Tenure (Yrs)',
    '3M Return (%)',
    '6M Return (%)',
    '1Y CAGR (%)',
    '3Y CAGR (%)',
    '5Y CAGR (%)',
    '7Y CAGR (%)',
    '10Y CAGR (%)',
    'Annualized Volatility (%)',
    'Sharpe Ratio',
    'Sortino Ratio',
    'Beta (vs Benchmark)',
    "Jensen's Alpha (%)",
    'R-Squared',
    'Tracking Error (%)',
    'Information Ratio',
    'Max Drawdown (%)',
    'Recovery Days',
    'Calmar Ratio',
    'Upside Capture (%)',
    'Downside Capture (%)',
    '1Y Rolling Mean (%)',
    '1Y Rolling Median (%)',
    '1Y Rolling Min (%)',
    '1Y Rolling Max (%)',
    '1Y Rolling 25th %ile (%)',
    '1Y Rolling 75th %ile (%)',
    '1Y Rolling Std Dev',
    '1Y Rolling % Positive Windows',
    '1Y Benchmark Hit Rate (%)',
    '3Y Rolling Mean (%)',
    '3Y Rolling Median (%)',
    '3Y Rolling Min (%)',
    '3Y Rolling Max (%)',
    '3Y Rolling 25th %ile (%)',
    '3Y Rolling 75th %ile (%)',
    '3Y Rolling Std Dev',
    '3Y Rolling % Positive Windows',
    '3Y Benchmark Hit Rate (%)',
    '5Y Rolling Mean (%)',
    '5Y Rolling Median (%)',
    '5Y Rolling Min (%)',
    '5Y Rolling Max (%)',
    '5Y Rolling 25th %ile (%)',
    '5Y Rolling 75th %ile (%)',
    '5Y Rolling Std Dev',
    '5Y Rolling % Positive Windows',
    '5Y Benchmark Hit Rate (%)',
    '7Y Rolling Mean (%)',
    '7Y Rolling Median (%)',
    '7Y Rolling Min (%)',
    '7Y Rolling Max (%)',
    '7Y Rolling 25th %ile (%)',
    '7Y Rolling 75th %ile (%)',
    '7Y Rolling Std Dev',
    '7Y Rolling % Positive Windows',
    '7Y Benchmark Hit Rate (%)',
  ];

  const rows = selectedFunds.map((fund) => {
    const valReport = validationMap[fund.scheme_code];
    const eff = resolveEffectiveFundState(
      fund,
      valReport,
      identityMap?.[fund.scheme_code],
      seriesMap[fund.scheme_code] || []
    );
    const rm = eff.usable ? riskMetrics.find((r) => r.schemeCode === fund.scheme_code) : undefined;
    const cagr = eff.usable ? trailingMetaMap[fund.scheme_code]?.values || {} : {};
    const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(
      eff.effectiveSeries,
      valReport,
      benchmarkStatus
    );

    const hCov = computeHoldingsCoverage(fund.holdings, fund.holdingsStatus.partialCoverage);
    const holdingsCovLabel = !hCov.hasHoldings
      ? 'unavailable'
      : hCov.isComplete
      ? 'complete'
      : 'partial_subset';

    const diag = valReport?.rejectedPayloadDiagnostics ?? null;

    const rollCells = (dist: typeof r1, hit: number | null) =>
      dist.available && dist.count > 0
        ? [
            csvNum(dist.mean),
            csvNum(dist.median),
            csvNum(dist.min),
            csvNum(dist.max),
            csvNum(dist.q25),
            csvNum(dist.q75),
            csvNum(dist.std),
            csvNum(dist.pctPositive),
            csvNum(hit),
          ]
        : [
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
          ];

    return [
      fund.scheme_code,
      csvText(fund.name),
      eff.effectiveIdentity.registrySchemeCode ?? '"Unavailable"',
      csvText(eff.effectiveIdentity.registryName),
      csvText(eff.effectiveIdentity.registryIsin),
      csvText(eff.effectiveIdentity.registryMatched ? 'Yes' : 'No'),
      eff.effectiveIdentity.providerSchemeCode ?? '"Unavailable"',
      csvText(eff.effectiveIdentity.providerName),
      csvText(eff.effectiveIdentity.providerIsin),
      csvText(eff.effectiveIdentity.status),
      csvText(eff.failureReason || eff.effectiveIdentity.reason || 'Verified'),
      csvText(valReport?.status || 'unavailable'),
      csvText(eff.valuationCutoffDate),
      eff.rejectedPostCutoffCount,
      diag?.returnedSchemeCode ?? '"None"',
      diag ? diag.totalRawCount : 0,
      csvText(diag?.reason ?? 'None'),
      csvText(
        eff.usable && valReport?.quarantinedFromBreak
          ? valReport.corporateActionBreaks.map((b) => `${b.date} (${b.pctChange}%)`).join('; ')
          : 'None'
      ),
      csvText(eff.earliestDate),
      csvText(eff.latestDate),
      eff.validCount,
      csvText(holdingsCovLabel),
      hCov.hasHoldings ? hCov.disclosedWeightPct : '"Unavailable"',
      hCov.hasHoldings ? hCov.unknownWeightPct : '"Unavailable"',
      csvText(fund.isin),
      csvText(fund.plan),
      csvText(fund.option),
      csvText(fund.category),
      csvText(fund.asset_class),
      csvText(fund.fund_house),
      csvText(benchmarkStatus.name),
      csvText(benchmarkStatus.available ? `Verified (${benchmarkStatus.variant})` : 'Unavailable'),
      rfRate.toFixed(2),
      csvNum(fund.aum_cr),
      csvNum(fund.expense_ratio_direct),
      csvNum(fund.turnover_ratio_pct),
      csvText(fund.riskometer),
      csvText(fund.inception_date),
      csvText(fund.manager?.name ?? null),
      csvNum(fund.manager?.tenureYears ?? null),
      csvNum(cagr['3M']),
      csvNum(cagr['6M']),
      csvNum(cagr['1Y']),
      csvNum(cagr['3Y']),
      csvNum(cagr['5Y']),
      csvNum(cagr['7Y']),
      csvNum(cagr['10Y']),
      csvNum(rm?.volatility),
      csvNum(rm?.sharpe),
      csvNum(rm?.sortino),
      csvNum(rm?.beta),
      csvNum(rm?.jensensAlpha),
      csvNum(rm?.rSquared),
      csvNum(rm?.trackingError),
      csvNum(rm?.informationRatio),
      csvNum(rm?.maxDrawdown),
      csvNum(rm?.recoveryDays),
      csvNum(rm?.calmarRatio),
      csvNum(rm?.upsideCapture),
      csvNum(rm?.downsideCapture),
      ...rollCells(r1, hit1),
      ...rollCells(r3, hit3),
      ...rollCells(r5, hit5),
      ...rollCells(r7, hit7),
    ].join(',');
  });

  return [...provenance, headers.join(','), ...rows].join('\n');
}

export function buildComparisonJsonPayload(input: ExportBuilderInput) {
  const {
    selectedFunds,
    riskMetrics,
    trailingMetaMap,
    seriesMap,
    validationMap,
    identityMap,
    holdingsOverlap,
    benchmarkStatus,
    rfRate,
    exportTimestamp = new Date().toISOString(),
  } = input;

  return {
    metadata: {
      system: 'Indian Mutual Funds Quantitative & Risk Analytics Studio',
      exportTimestamp,
      navDataSource: 'api.mfapi.in (third-party AMFI NAV mirror; strictly validated)',
      identityRegistry: `AMFI India NAVAll Snapshot (${AMFI_SNAPSHOT_DATE})`,
      riskFreeRateAppliedPct: rfRate,
      benchmark: {
        symbol: benchmarkStatus.symbol,
        name: benchmarkStatus.name,
        variant: benchmarkStatus.variant,
        available: benchmarkStatus.available,
        source: benchmarkStatus.source,
        asOfDate: benchmarkStatus.asOfDate,
        reason: benchmarkStatus.reason,
      },
      holdingsOverlap: holdingsOverlap ?? null,
    },
    funds: selectedFunds.map((fund) => {
      const valReport = validationMap[fund.scheme_code] || null;
      const eff = resolveEffectiveFundState(
        fund,
        valReport ?? undefined,
        identityMap?.[fund.scheme_code],
        seriesMap[fund.scheme_code] || []
      );
      const rm = eff.usable ? riskMetrics.find((r) => r.schemeCode === fund.scheme_code) || null : null;
      const cagrMeta = eff.usable
        ? trailingMetaMap[fund.scheme_code] || { values: {}, unavailableReasons: {} }
        : {
            values: {},
            unavailableReasons: {
              all: eff.failureReason || 'Scheme validation failed; metrics suppressed.',
            },
          };
      const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(
        eff.effectiveSeries,
        valReport ?? undefined,
        benchmarkStatus
      );
      const hCov = computeHoldingsCoverage(fund.holdings, fund.holdingsStatus.partialCoverage);

      return {
        meta: fund,
        effectiveIdentity: eff.effectiveIdentity,
        usable: eff.usable,
        failureReason: eff.failureReason,
        navValidation: valReport
          ? {
              ...valReport,
              validCount: eff.validCount,
              earliestDate: eff.earliestDate,
              latestDate: eff.latestDate,
            }
          : null,
        holdingsCoverage: {
          available: hCov.hasHoldings,
          partialCoverage: hCov.hasHoldings && !hCov.isComplete,
          disclosedWeightPct: hCov.hasHoldings ? hCov.disclosedWeightPct : null,
          unknownWeightPct: hCov.hasHoldings ? hCov.unknownWeightPct : null,
          thresholdPct: FULL_HOLDINGS_COVERAGE_THRESHOLD_PCT,
          exactFullPortfolioAnalyticsAllowed: hCov.isComplete,
        },
        trailingReturns: cagrMeta.values,
        trailingUnavailableReasons: cagrMeta.unavailableReasons,
        riskMetrics: rm,
        rollingDistributions: {
          '1Year': { ...r1, hitRatePct: hit1 },
          '3Year': { ...r3, hitRatePct: hit3 },
          '5Year': { ...r5, hitRatePct: hit5 },
          '7Year': { ...r7, hitRatePct: hit7 },
        },
        holdings: fund.holdings,
      };
    }),
  };
}

export function buildSingleFundFactsheetCsv(
  fund: FundMeta,
  input: ExportBuilderInput
): string {
  const {
    riskMetrics,
    trailingMetaMap,
    seriesMap,
    validationMap,
    identityMap,
    benchmarkStatus,
    rfRate,
    exportTimestamp = new Date().toISOString(),
  } = input;

  const valReport = validationMap[fund.scheme_code];
  const eff = resolveEffectiveFundState(
    fund,
    valReport,
    identityMap?.[fund.scheme_code],
    seriesMap[fund.scheme_code] || []
  );

  const rm = eff.usable ? riskMetrics.find((r) => r.schemeCode === fund.scheme_code) : undefined;
  const cagrMeta = eff.usable
    ? trailingMetaMap[fund.scheme_code] || { values: {}, unavailableReasons: {} }
    : {
        values: {},
        unavailableReasons: {
          '3M': eff.failureReason || 'Unavailable',
          '6M': eff.failureReason || 'Unavailable',
          '1Y': eff.failureReason || 'Unavailable',
          '3Y': eff.failureReason || 'Unavailable',
          '5Y': eff.failureReason || 'Unavailable',
          '7Y': eff.failureReason || 'Unavailable',
          '10Y': eff.failureReason || 'Unavailable',
        },
      };
  const cagr = cagrMeta.values;
  const { r1, r3, r5, r7, hit1, hit3, hit5, hit7 } = getRollingAnalyticsForFund(
    eff.effectiveSeries,
    valReport,
    benchmarkStatus
  );

  const hCov = computeHoldingsCoverage(fund.holdings, fund.holdingsStatus.partialCoverage);
  const diag = valReport?.rejectedPayloadDiagnostics ?? null;

  const fmtRollRow = (label: string, r: typeof r1, hit: number | null) =>
    [
      csvText(label),
      r.available && r.count > 0 ? csvNum(r.mean) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.median) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.min) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.max) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.q25) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.q75) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.std) : '"Unavailable"',
      r.available && r.count > 0 ? csvNum(r.pctPositive, '%') : '"Unavailable"',
      csvNum(hit, '%'),
      csvText(eff.failureReason || r.unavailableReason || (hit === null ? benchmarkStatus.reason || 'Unavailable' : 'OK')),
    ].join(',');

  const lines: string[] = [
    `# Data Provenance: Indian Mutual Funds Quantitative & Risk Analytics Studio`,
    `# NAV Feed Source: api.mfapi.in/mf/${fund.scheme_code} (Status: ${valReport?.status || 'unavailable'})`,
    `# AMFI Identity Reconciliation: ${eff.effectiveIdentity.status} (${AMFI_SNAPSHOT_DATE})`,
    `# Benchmark Status: ${benchmarkStatus.name} | Variant: ${benchmarkStatus.variant} | Available: ${benchmarkStatus.available}`,
    `# Risk-Free Rate Applied: ${rfRate.toFixed(2)}%`,
    `# Disclosure Source: ${fund.disclosureSource || 'Unavailable'}`,
    `# Export Timestamp: ${exportTimestamp}`,
    `#`,
    `"FUND FACTSHEET & QUANTITATIVE DOSSIER"`,
    `"Scheme Name",${csvText(fund.name)}`,
    `"Scheme Code",${fund.scheme_code}`,
    `"Registry Scheme Code",${eff.effectiveIdentity.registrySchemeCode ?? '"Unavailable"'}`,
    `"Registry Name",${csvText(eff.effectiveIdentity.registryName)}`,
    `"Registry ISIN",${csvText(eff.effectiveIdentity.registryIsin)}`,
    `"Registry Matched",${csvText(eff.effectiveIdentity.registryMatched ? 'Yes' : 'No')}`,
    `"Fetched Scheme Code",${eff.effectiveIdentity.providerSchemeCode ?? '"Unavailable"'}`,
    `"Fetched Scheme Name",${csvText(eff.effectiveIdentity.providerName)}`,
    `"Fetched ISIN",${csvText(eff.effectiveIdentity.providerIsin)}`,
    `"ISIN",${csvText(fund.isin)}`,
    `"Plan / Option",${csvText(`${fund.plan} / ${fund.option}`)}`,
    `"Effective Identity Status",${csvText(eff.effectiveIdentity.status)}`,
    `"Identity / Failure Reason",${csvText(eff.failureReason || eff.effectiveIdentity.reason)}`,
    `"NAV Validation Status",${csvText(valReport?.status || 'unavailable')}`,
    `"Valuation Cutoff Date",${csvText(eff.valuationCutoffDate)}`,
    `"Rejected Post-Cutoff Count",${eff.rejectedPostCutoffCount}`,
    `"NAV Validation Window",${csvText(eff.earliestDate && eff.latestDate ? `${eff.earliestDate} to ${eff.latestDate}` : null)}`,
    `"Validated NAV Observations",${eff.validCount}`,
    `"Rejected Payload Diagnostics",${csvText(diag ? `Requested ${diag.requestedSchemeCode}, Returned ${diag.returnedSchemeCode ?? 'null'} (${diag.totalRawCount} raw obs): ${diag.reason}` : 'None')}`,
    `"Holdings Coverage Status",${csvText(!hCov.hasHoldings ? 'Unavailable' : hCov.isComplete ? 'Complete (>=95%)' : 'Partial Subset (<95% exact overlap suppressed)')}`,
    `"Holdings Disclosed (%)",${hCov.hasHoldings ? hCov.disclosedWeightPct : '"Unavailable"'}`,
    `"Holdings Unknown (%)",${hCov.hasHoldings ? hCov.unknownWeightPct : '"Unavailable"'}`,
    `"Category",${csvText(fund.category)}`,
    `"Asset Class",${csvText(fund.asset_class)}`,
    `"Fund House",${csvText(fund.fund_house)}`,
    `"Selected Benchmark",${csvText(`${benchmarkStatus.name} (${benchmarkStatus.variant})`)}`,
    `"Inception Date",${csvText(fund.inception_date)}`,
    `"AUM (Cr INR)",${csvNum(fund.aum_cr)}`,
    `"Direct TER (%)",${csvNum(fund.expense_ratio_direct)}`,
    `"Turnover Ratio (%)",${csvNum(fund.turnover_ratio_pct)}`,
    `"Riskometer",${csvText(fund.riskometer)}`,
    `"Lead Manager",${csvText(fund.manager?.name ?? null)}`,
    `"Manager Tenure (Years)",${csvNum(fund.manager?.tenureYears ?? null)}`,
    ``,
    `"TRAILING RETURNS","Value (%)","Status / Reason"`,
    `"3 Months (Absolute)",${csvNum(cagr['3M'])},${csvText(cagrMeta.unavailableReasons['3M'] || 'OK')}`,
    `"6 Months (Absolute)",${csvNum(cagr['6M'])},${csvText(cagrMeta.unavailableReasons['6M'] || 'OK')}`,
    `"1 Year (CAGR)",${csvNum(cagr['1Y'])},${csvText(cagrMeta.unavailableReasons['1Y'] || 'OK')}`,
    `"3 Years (CAGR)",${csvNum(cagr['3Y'])},${csvText(cagrMeta.unavailableReasons['3Y'] || 'OK')}`,
    `"5 Years (CAGR)",${csvNum(cagr['5Y'])},${csvText(cagrMeta.unavailableReasons['5Y'] || 'OK')}`,
    `"7 Years (CAGR)",${csvNum(cagr['7Y'])},${csvText(cagrMeta.unavailableReasons['7Y'] || 'OK')}`,
    `"10 Years (CAGR)",${csvNum(cagr['10Y'])},${csvText(cagrMeta.unavailableReasons['10Y'] || 'OK')}`,
    ``,
    `"ROLLING RETURN DISTRIBUTIONS & HIT RATES"`,
    `"Window","Mean (%)","Median (%)","Min (%)","Max (%)","25th %ile","75th %ile","Std Dev","% Positive Windows","Benchmark Hit Rate (%)","Status / Reason"`,
    fmtRollRow('1-Year Rolling', r1, hit1),
    fmtRollRow('3-Year Rolling', r3, hit3),
    fmtRollRow('5-Year Rolling', r5, hit5),
    fmtRollRow('7-Year Rolling', r7, hit7),
    ``,
    `"RISK RATIOS & ACTIVE METRICS (Rf=${rfRate.toFixed(2)}%)"`,
    `"Metric","Value","Note"`,
    `"Annualized Volatility (%)",${csvNum(rm?.volatility)},${csvText(eff.failureReason || rm?.unavailableReasons?.fundOnly || rm?.unavailableReasons?.corporateAction || 'OK')}`,
    `"Sharpe Ratio",${csvNum(rm?.sharpe)},${csvText(eff.failureReason || rm?.unavailableReasons?.sharpe || 'OK')}`,
    `"Sortino Ratio",${csvNum(rm?.sortino)},${csvText(eff.failureReason || rm?.unavailableReasons?.sortino || 'OK')}`,
    `"Beta",${csvNum(rm?.beta)},${csvText(eff.failureReason || rm?.unavailableReasons?.beta || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"Jensen's Alpha (%)",${csvNum(rm?.jensensAlpha)},${csvText(eff.failureReason || rm?.unavailableReasons?.jensensAlpha || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"R-Squared",${csvNum(rm?.rSquared)},${csvText(eff.failureReason || rm?.unavailableReasons?.rSquared || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"Tracking Error (%)",${csvNum(rm?.trackingError)},${csvText(eff.failureReason || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"Information Ratio",${csvNum(rm?.informationRatio)},${csvText(eff.failureReason || rm?.unavailableReasons?.informationRatio || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"Maximum Drawdown (%)",${csvNum(rm?.maxDrawdown)},${csvText(eff.failureReason || rm?.unavailableReasons?.fundOnly || rm?.unavailableReasons?.corporateAction || 'OK')}`,
    `"Recovery Period (Days)",${csvNum(rm?.recoveryDays)},${csvText(eff.failureReason || (rm?.recoveryDays == null ? rm?.unavailableReasons?.fundOnly || rm?.unavailableReasons?.corporateAction || 'Unavailable' : 'OK'))}`,
    `"Calmar Ratio",${csvNum(rm?.calmarRatio)},${csvText(eff.failureReason || rm?.unavailableReasons?.calmarRatio || 'OK')}`,
    `"Upside Capture (%)",${csvNum(rm?.upsideCapture)},${csvText(eff.failureReason || rm?.unavailableReasons?.upsideCapture || rm?.unavailableReasons?.benchmark || 'OK')}`,
    `"Downside Capture (%)",${csvNum(rm?.downsideCapture)},${csvText(eff.failureReason || rm?.unavailableReasons?.downsideCapture || rm?.unavailableReasons?.benchmark || 'OK')}`,
    ``,
    `"PORTFOLIO HOLDINGS & LIQUIDITY"`,
    `"ISIN","Security Name","Sector","Market Cap","Weight (%)","30D ADTV (Cr INR)"`,
    ...(fund.holdings && fund.holdings.length > 0
      ? fund.holdings.map((h) =>
          [
            csvText(h.isin),
            csvText(h.name),
            csvText(h.sector),
            csvText(h.mcap),
            h.weight,
            csvNum(h.adtv_cr),
          ].join(',')
        )
      : [
          [
            '"Unavailable"',
            csvText(fund.holdingsStatus.reason || 'Unavailable'),
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
            '"Unavailable"',
          ].join(','),
        ]),
  ];

  return lines.join('\n');
}

export function buildRawNavCsv(input: ExportBuilderInput): string {
  const {
    selectedFunds,
    seriesMap,
    validationMap,
    identityMap,
    benchmarkStatus,
    exportTimestamp = new Date().toISOString(),
  } = input;

  const effectiveStates = selectedFunds.map((f) => {
    const valReport = validationMap[f.scheme_code];
    const eff = resolveEffectiveFundState(
      f,
      valReport,
      identityMap?.[f.scheme_code],
      seriesMap[f.scheme_code] || []
    );
    return { fund: f, valReport, eff };
  });

  const allDatesSet = new Set<string>();
  const benchSeries = benchmarkStatus.available ? benchmarkStatus.series : [];
  benchSeries.forEach((p) => allDatesSet.add(p.date));

  effectiveStates.forEach(({ eff }) => {
    if (eff.usable) {
      eff.effectiveSeries.forEach((p) => allDatesSet.add(p.date));
    }
  });

  const dates = Array.from(allDatesSet).sort();
  const benchMap = new Map(benchSeries.map((p) => [p.date, p.nav]));
  const fundMaps = effectiveStates.map(({ eff }) => ({
    usable: eff.usable,
    map: new Map(
      (eff.usable ? eff.effectiveSeries : []).map((p) => [p.date, p.nav])
    ),
  }));

  const perFundValidationLines = effectiveStates.map(({ fund, valReport, eff }) => {
    const diag = valReport?.rejectedPayloadDiagnostics;
    const diagNote = diag
      ? ` | Diagnostics: requested=${diag.requestedSchemeCode}, returned=${diag.returnedSchemeCode ?? 'null'}, rawRejectedObs=${diag.totalRawCount}`
      : '';
    return `# Scheme ${fund.scheme_code} (${fund.name}) | Status: ${valReport?.status || 'unavailable'} | Identity: ${eff.effectiveIdentity.status} | ValidObs: ${eff.validCount} | Window: ${eff.earliestDate ?? 'Unavailable'}..${eff.latestDate ?? 'Unavailable'} | FailureReason: ${eff.failureReason ?? 'None (OK)'}${diagNote}`;
  });

  const provenance = [
    `# Data Provenance: Indian Mutual Funds Quantitative & Risk Analytics Studio`,
    `# NAV Time-Series Source: api.mfapi.in (verified scheme identities & validated NAV observations)`,
    `# Benchmark: ${benchmarkStatus.name} (${benchmarkStatus.symbol}) | Variant: ${benchmarkStatus.variant} | Status: ${benchmarkStatus.available ? `Verified (${benchmarkStatus.source})` : `Unavailable (${benchmarkStatus.reason})`}`,
    `# Export Timestamp: ${exportTimestamp}`,
    `# Total Validated Trading Dates: ${dates.length}`,
    `# SCHEME_VALIDATION_STATUS:`,
    ...perFundValidationLines,
    `#`,
  ];

  const benchHeader = benchmarkStatus.available
    ? `Benchmark_${sanitizeFilenamePart(benchmarkStatus.name)}_${benchmarkStatus.variant}`
    : `Benchmark_${sanitizeFilenamePart(benchmarkStatus.name)}_Unavailable`;

  const headers = [
    'Date',
    benchHeader,
    ...effectiveStates.map(({ fund, eff }) =>
      csvText(
        eff.usable
          ? `${fund.name} (${fund.scheme_code})`
          : `${fund.name} (${fund.scheme_code}) [Unavailable: ${eff.failureReason}]`
      )
    ),
  ];

  const rows = dates.map((d) => {
    const bNav = benchmarkStatus.available ? (benchMap.get(d) ?? '') : 'Unavailable';
    const fundNavs = fundMaps.map((fm) => {
      if (!fm.usable) return '"Unavailable"';
      const nav = fm.map.get(d);
      return nav !== undefined ? nav : '';
    });
    return [d, bNav, ...fundNavs].join(',');
  });

  return [...provenance, headers.join(','), ...rows].join('\n');
}

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFunds: FundMeta[];
  riskMetrics: RiskMetrics[];
  trailingMetaMap: Record<number, TrailingCagrResult>;
  seriesMap: Record<number, NavPoint[]>;
  validationMap: Record<number, NavValidationReport | undefined>;
  identityMap?: Record<number, SchemeIdentityAudit | undefined>;
  holdingsOverlap?: OverlapMatrixResult;
  benchmarkStatus: BenchmarkStatus;
  rfRate: number;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  selectedFunds,
  riskMetrics,
  trailingMetaMap,
  seriesMap,
  validationMap,
  identityMap,
  holdingsOverlap,
  benchmarkStatus,
  rfRate,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [individualFundCode, setIndividualFundCode] = useState<number>(
    selectedFunds[0]?.scheme_code || 122639
  );

  if (!isOpen) return null;

  const getFormattedDateTime = (): string => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const getExportFilename = (prefix: string, extension: string, singleFundName?: string): string => {
    const timestamp = getFormattedDateTime();
    if (singleFundName) {
      return `${sanitizeFilenamePart(singleFundName)}_${timestamp}_${prefix}.${extension}`;
    }
    if (selectedFunds.length === 1) {
      return `${sanitizeFilenamePart(selectedFunds[0].name)}_${timestamp}_${prefix}.${extension}`;
    }
    if (selectedFunds.length === 2) {
      return `Comparison_${sanitizeFilenamePart(selectedFunds[0].name)}_vs_${sanitizeFilenamePart(selectedFunds[1].name)}_${timestamp}_${prefix}.${extension}`;
    }
    if (selectedFunds.length === 3) {
      return `Comparison_${sanitizeFilenamePart(selectedFunds[0].name)}_${sanitizeFilenamePart(selectedFunds[1].name)}_${sanitizeFilenamePart(selectedFunds[2].name)}_${timestamp}_${prefix}.${extension}`;
    }
    const leadName = sanitizeFilenamePart(selectedFunds[0]?.name || 'Portfolio');
    return `Portfolio_${selectedFunds.length}_Funds_${leadName}_${timestamp}_${prefix}.${extension}`;
  };

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
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const builderInput: ExportBuilderInput = {
    selectedFunds,
    riskMetrics,
    trailingMetaMap,
    seriesMap,
    validationMap,
    identityMap,
    holdingsOverlap,
    benchmarkStatus,
    rfRate,
  };

  const handleExportComparisonCsv = () => {
    triggerDownload(
      getExportFilename('Comparison_Report', 'csv'),
      buildComparisonCsv(builderInput),
      'text/csv'
    );
  };

  const handleExportComparisonJson = () => {
    triggerDownload(
      getExportFilename('Analytics_Package', 'json'),
      JSON.stringify(buildComparisonJsonPayload(builderInput), null, 2),
      'application/json'
    );
  };

  const handleExportSingleFundCsv = () => {
    const fund = selectedFunds.find((f) => f.scheme_code === individualFundCode) || selectedFunds[0];
    if (!fund) return;
    triggerDownload(
      getExportFilename('Factsheet', 'csv', fund.name),
      buildSingleFundFactsheetCsv(fund, builderInput),
      'text/csv'
    );
  };

  const handleExportRawNavCsv = () => {
    triggerDownload(
      getExportFilename('Daily_NAV_Timeseries', 'csv'),
      buildRawNavCsv(builderInput),
      'text/csv'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Mutual Fund Analytics</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Synchronized with validated scheme identities, Rf={rfRate.toFixed(2)}%, and benchmark availability ({benchmarkStatus.available ? benchmarkStatus.variant : 'Unavailable'}).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3.5">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Downloaded: <code className="font-mono font-semibold text-emerald-200">{downloadSuccess}</code></span>
            </div>
          )}

          <div
            onClick={handleExportComparisonCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Full Comparison Report (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Includes scheme identity status, validation window, and &ldquo;Unavailable&rdquo; markers for unsupported benchmark metrics.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              CSV
            </button>
          </div>

          <div
            onClick={handleExportComparisonJson}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Complete Analytics Package (JSON)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Exact structured parity with UI state: null metrics + unavailableReasons + validation report + Rf applied.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              JSON
            </button>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">Single Fund Factsheet &amp; Holdings (CSV)</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Individual dossier with disclosure provenance, validation window, and holdings availability.
                  </div>
                </div>
              </div>
              <button
                onClick={handleExportSingleFundCsv}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-semibold rounded-lg text-white transition-colors shrink-0"
              >
                Export
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Select Scheme:</span>
              <div className="relative">
                <select
                  value={individualFundCode}
                  onChange={(e) => setIndividualFundCode(parseInt(e.target.value, 10))}
                  className="appearance-none bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {selectedFunds.map((f) => (
                    <option key={f.scheme_code} value={f.scheme_code}>
                      {f.name} ({f.scheme_code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div
            onClick={handleExportRawNavCsv}
            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Raw Validated Daily NAV Time-Series (CSV)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  All validated mfapi.in sessions for selected funds; benchmark column marks Unavailable if unverified.
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-800 group-hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-200 group-hover:text-white transition-colors shrink-0">
              CSV
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{selectedFunds.length} scheme(s) active</span>
          <span className="font-mono">Source: mfapi.in + AMFI {AMFI_SNAPSHOT_DATE}</span>
        </div>
      </div>
    </div>
  );
};
