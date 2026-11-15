/**
 * AMFI Scheme Category Classifier (Fact-Safe Batch 1 Edition)
 * Maps raw mfapi.in metadata into structured FundMeta entities WITHOUT inventing
 * unsourced AUM, TER, turnover, manager track records, holdings, or debt statistics.
 */

import { AssetClass, FundMeta } from '../types/quant';
import {
  DiscoveryValidationOptions,
  isValidIsin,
  parsePlanAndOption,
  validateDiscoveredSchemeIdentity,
} from './schemeIdentity';

export interface MfapiMeta {
  fund_house?: string;
  scheme_type?: string;
  scheme_category?: string;
  scheme_code: number;
  scheme_name: string;
  isin_growth?: string | null;
  isin_div_reinvestment?: string | null;
}

export function classifyAndBuildFundMeta(
  meta: MfapiMeta,
  discoveryOptions: DiscoveryValidationOptions = {}
): FundMeta {
  const effectiveCode = discoveryOptions.requestedCode ?? meta.scheme_code;
  const name = (meta.scheme_name || `Scheme ${effectiveCode}`).trim();
  const rawCat = (meta.scheme_category || '').toLowerCase();
  const rawName = name.toLowerCase();

  let assetClass: AssetClass = 'Equity';
  let category = meta.scheme_category
    ? meta.scheme_category.replace(/^(Equity|Debt|Hybrid|Other)\s*Scheme\s*-\s*/i, '').trim()
    : 'Unclassified';
  let benchmarkSymbol = '^CRSLDX';

  if (
    rawCat.includes('debt') ||
    rawCat.includes('income') ||
    rawCat.includes('bond') ||
    rawCat.includes('liquid') ||
    rawCat.includes('money market') ||
    rawCat.includes('gilt') ||
    rawCat.includes('overnight') ||
    rawName.includes('debt') ||
    rawName.includes('liquid') ||
    rawName.includes('bond') ||
    rawName.includes('gilt')
  ) {
    assetClass = 'Debt';
    benchmarkSymbol = 'CRISIL_COMP_BOND';
    category = rawCat.includes('liquid')
      ? 'Liquid Fund'
      : rawCat.includes('gilt')
      ? 'Gilt Fund'
      : rawCat.includes('banking')
      ? 'Banking & PSU Debt'
      : 'Debt Scheme';
  } else if (
    rawCat.includes('hybrid') ||
    rawCat.includes('balanced') ||
    rawCat.includes('arbitrage') ||
    rawCat.includes('equity savings') ||
    rawName.includes('hybrid') ||
    rawName.includes('balanced')
  ) {
    assetClass = 'Hybrid';
    category = 'Hybrid / Dynamic Allocation';
    benchmarkSymbol = '^CRSLDX';
  } else if (
    rawCat.includes('gold') ||
    rawCat.includes('silver') ||
    rawName.includes('gold') ||
    rawName.includes('silver')
  ) {
    assetClass = 'Commodity';
    category = 'Gold & Precious Metals';
    benchmarkSymbol = 'GOLD_DOMESTIC';
  } else if (
    rawCat.includes('nasdaq') ||
    rawCat.includes('global') ||
    rawCat.includes('international') ||
    rawCat.includes('overseas') ||
    rawName.includes('nasdaq') ||
    rawName.includes('s&p 500') ||
    rawName.includes('global') ||
    rawName.includes('international')
  ) {
    assetClass = 'International';
    category = 'International FoF';
    benchmarkSymbol = 'UNAVAILABLE_INTL';
  } else if (rawCat.includes('small cap') || rawName.includes('small cap') || rawName.includes('smallcap')) {
    assetClass = 'Equity';
    category = 'Small Cap';
    benchmarkSymbol = 'NIFTYSMALLCAP250.NS';
  } else if (rawCat.includes('mid cap') || rawName.includes('mid cap') || rawName.includes('midcap')) {
    assetClass = 'Equity';
    category = 'Mid Cap';
    benchmarkSymbol = 'NIFTYMIDCAP150.NS';
  } else if (
    rawCat.includes('large cap') ||
    rawCat.includes('bluechip') ||
    rawCat.includes('top 100') ||
    rawCat.includes('nifty 50') ||
    rawName.includes('large cap') ||
    rawName.includes('bluechip') ||
    rawName.includes('top 100') ||
    rawName.includes('nifty 50')
  ) {
    assetClass = 'Equity';
    category = 'Large Cap';
    benchmarkSymbol = '^NSEI';
  } else if (rawCat.includes('elss') || rawCat.includes('tax') || rawName.includes('elss') || rawName.includes('tax')) {
    assetClass = 'Equity';
    category = 'ELSS Tax Saver';
    benchmarkSymbol = '^CRSLDX';
  } else if (rawCat.includes('flexi cap') || rawName.includes('flexi cap')) {
    assetClass = 'Equity';
    category = 'Flexi Cap';
    benchmarkSymbol = '^CRSLDX';
  }

  const parsed = parsePlanAndOption(name);
  const candidateIsin =
    parsed.option === 'IDCW'
      ? meta.isin_div_reinvestment || meta.isin_growth || null
      : meta.isin_growth || null;
  const resolvedIsin = candidateIsin && isValidIsin(candidateIsin) ? candidateIsin.trim().toUpperCase() : null;
  const identityStatus = validateDiscoveredSchemeIdentity(
    {
      scheme_code: meta.scheme_code,
      scheme_name: name,
      isin_growth: meta.isin_growth,
      isin_div_reinvestment: meta.isin_div_reinvestment,
      fund_house: meta.fund_house,
      scheme_category: meta.scheme_category,
      scheme_type: meta.scheme_type,
    },
    {
      ...discoveryOptions,
      requestedCode: effectiveCode,
    }
  );

  return {
    scheme_code: identityStatus.scheme_code,
    name: identityStatus.verified ? identityStatus.registryName || name : name,
    category,
    asset_class: assetClass,
    fund_house: meta.fund_house || 'Unavailable (not supplied by feed)',
    benchmark_symbol: benchmarkSymbol,
    isin: identityStatus.verified ? identityStatus.registryIsin || resolvedIsin : resolvedIsin,
    plan: identityStatus.verified ? identityStatus.registryPlan : identityStatus.providerPlan,
    option: identityStatus.verified ? identityStatus.registryOption : identityStatus.providerOption,
    aum_cr: null,
    aum_as_of: null,
    inception_date: null,
    expense_ratio_direct: null,
    expense_ratio_regular: null,
    turnover_ratio_pct: null,
    riskometer: null,
    exit_load: null,
    min_sip_inr: null,
    min_lumpsum_inr: null,
    investment_objective: null,
    manager: null,
    macaulay_duration: null,
    modified_duration: null,
    ytm: null,
    avg_maturity_years: null,
    credit_profile: null,
    holdings: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason:
        'Unavailable: Monthly AMC security-level portfolio disclosure has not been ingested for this discovered scheme (Batch 5).',
    },
    identityStatus,
    disclosureSource: 'mfapi.in (NAV & AMFI scheme identity check; AMC factsheet unavailable)',
    asOfDate: null,
    isStatutoryDisclosure: false,
  };
}
