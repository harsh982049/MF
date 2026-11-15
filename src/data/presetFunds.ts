import {
  CorporateActionRecord,
  FundMeta,
  NavPoint,
  OptionType,
  PlanType,
  ValidatedNavSeries,
} from '../types/quant';
import {
  BENCHMARK_REGISTRY,
  BENCHMARKS,
  computeCanonicalSeriesSha256,
  ExternalBenchmarkInput,
  isNseTradingDay,
  resolveBenchmarkSeries,
  resolveVerifiedBenchmarkSeries,
  validateBenchmarkSnapshot,
  VERIFIED_BENCHMARK_STORE,
} from './genuineBenchmarks';
import { getIndiaValuationDateIso, validateRawNavSeries } from '../utils/navValidator';
import {
  AMFI_SNAPSHOT_DATE,
  AMFI_SNAPSHOT_SOURCE,
  PRESET_RECONCILIATION_TABLE,
  ProviderSchemeMeta,
  TRUSTED_AMFI_REGISTRY,
  TrustedRegistryEntry,
  validateDiscoveredSchemeIdentity,
  validateSchemeIdentity,
} from '../utils/schemeIdentity';

export {
  BENCHMARK_REGISTRY,
  BENCHMARKS,
  computeCanonicalSeriesSha256,
  isNseTradingDay,
  resolveBenchmarkSeries,
  resolveVerifiedBenchmarkSeries,
  validateBenchmarkSnapshot,
  VERIFIED_BENCHMARK_STORE,
};

export const DEFAULT_VERIFIED_PRESET_CODES = [122639, 127042, 118778, 119598];

export const CATEGORIES_LIST = [
  'All',
  'Flexi Cap',
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'Multi Cap',
  'ELSS / Tax Saver',
  'Focused Equity',
  'Corporate Bond',
  'Banking & PSU Debt',
  'Gilt / Sovereign',
  'Liquid / Money Market',
  'Balanced Advantage / Dynamic',
  'Aggressive Hybrid',
  'Gold & Precious Metals',
  'International FoF',
];

export const AMC_LIST = [
  'All AMCs',
  'PPFAS Mutual Fund',
  'Motilal Oswal AMC',
  'HDFC Mutual Fund',
  'Nippon India Mutual Fund',
  'SBI Mutual Fund',
  'ICICI Prudential AMC',
  'Mirae Asset Mutual Fund',
  'Quant Mutual Fund',
  'Kotak Mahindra AMC',
  'Canara Robeco AMC',
];

const presetIdentity = (
  code: number,
  name: string,
  isin: string | null,
  acceptedAliases: string[] = []
) =>
  validateSchemeIdentity(
    {
      scheme_code: code,
      name,
      plan: 'Direct',
      option: 'Growth',
      isin,
      acceptedAliases,
    },
    {
      scheme_code: code,
      scheme_name: PRESET_RECONCILIATION_TABLE[code]?.amfiName || name,
      isin_growth: PRESET_RECONCILIATION_TABLE[code]?.amfiIsin || isin,
    }
  );

export const PRESET_FUNDS: Record<number, FundMeta> = {
  // 1. Flexi Cap — Verified exact AMFI match
  122639: {
    scheme_code: 122639,
    name: 'Parag Parikh Flexi Cap Fund',
    category: 'Flexi Cap',
    asset_class: 'Equity',
    fund_house: 'PPFAS Mutual Fund',
    benchmark_symbol: '^CRSLDX',
    isin: 'INF879O01027',
    plan: 'Direct',
    option: 'Growth',
    aum_cr: 145070.5,
    aum_as_of: '2026-09-30',
    inception_date: '2013-05-24',
    expense_ratio_direct: 0.61,
    expense_ratio_regular: 1.33,
    turnover_ratio_pct: 18.5,
    riskometer: 'Very High',
    exit_load: '2% if redeemed within 365 days; 1% between 366-730 days; Nil after 730 days.',
    min_sip_inr: 1000,
    min_lumpsum_inr: 1000,
    investment_objective:
      'To generate long-term capital growth from an actively managed portfolio primarily consisting of equity and equity-related securities, with tactical allocation to global equities and debt/cash collateral.',
    asOfDate: '2026-09-30',
    disclosureSource: `AMFI snapshot (${AMFI_SNAPSHOT_DATE}) & AMC Factsheet (2026-09-30, top disclosed positions; synthetic residuals removed)`,
    isStatutoryDisclosure: true,
    identityStatus: presetIdentity(122639, 'Parag Parikh Flexi Cap Fund', 'INF879O01027'),
    manager: {
      name: 'Rajeev Thakkar (CIO & Lead Fund Manager)',
      tenureYears: 13.5,
      overallExpYears: 28,
      education: 'B.Com, Chartered Accountant (CA), CFA Charterholder',
      bio: 'Pioneer of value investing philosophy in India. Steers Parag Parikh Flexi Cap since its inception in May 2013 with a disciplined buy-and-hold focus on moats, capital allocation efficiency, and international diversification.',
      otherFundsManaged: ['Parag Parikh Tax Saver Fund', 'Parag Parikh Dynamic Asset Allocation Fund'],
    },
    holdingsStatus: {
      available: true,
      asOfDate: '2026-09-30',
      source: 'PPFAS September 2026 Top Disclosed Equity Positions (partial coverage; exchange ADTV not ingested)',
      partialCoverage: true,
      disclosedWeightPct: 67.92,
      unknownWeightPct: 32.08,
      coverageThresholdPct: 100,
      reason: 'Disclosed subset sums to 67.92% of AUM (32.08% unknown/undisclosed). Full security-level monthly disclosure & exchange 30D ADTV ingestion scheduled in Batch 5.',
    },
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 7.75, adtv_cr: null },
      { isin: 'INE745G01035', name: 'Power Grid Corp of India', sector: 'Utilities', mcap: 'Large Cap', weight: 5.6, adtv_cr: null },
      { isin: 'INE154A01025', name: 'ITC Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 5.49, adtv_cr: null },
      { isin: 'INE522F01014', name: 'Coal India Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 5.39, adtv_cr: null },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 5.24, adtv_cr: null },
      { isin: 'INE118A01012', name: 'Bajaj Holdings & Inv Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.85, adtv_cr: null },
      { isin: 'US02079K3059', name: 'Alphabet Inc (Google)', sector: 'Technology', mcap: 'Large Cap', weight: 4.1, adtv_cr: null },
      { isin: 'US30303M1027', name: 'Meta Platforms Inc', sector: 'Technology', mcap: 'Large Cap', weight: 3.85, adtv_cr: null },
      { isin: 'US5949181045', name: 'Microsoft Corp', sector: 'Technology', mcap: 'Large Cap', weight: 3.2, adtv_cr: null },
      { isin: 'INE736A01011', name: 'CDSL Ltd', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.95, adtv_cr: null },
      { isin: 'INE544A01010', name: 'HCL Technologies Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 2.8, adtv_cr: null },
      { isin: 'INE585B01010', name: 'Maruti Suzuki India', sector: 'Automobile', mcap: 'Large Cap', weight: 2.45, adtv_cr: null },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 14.25, adtv_cr: null },
    ],
  },

  // 2. Mid Cap — ISIN reconciled to INF247L01445
  127042: {
    scheme_code: 127042,
    name: 'Motilal Oswal Midcap Fund',
    category: 'Mid Cap',
    asset_class: 'Equity',
    fund_house: 'Motilal Oswal AMC',
    benchmark_symbol: 'NIFTYMIDCAP150.NS',
    isin: 'INF247L01445',
    plan: 'Direct',
    option: 'Growth',
    aum_cr: 42851.59,
    aum_as_of: '2026-08-31',
    inception_date: '2014-02-24',
    expense_ratio_direct: 0.68,
    expense_ratio_regular: 1.74,
    turnover_ratio_pct: 42.0,
    riskometer: 'Very High',
    exit_load: 'Requires SID/KIM effective exit-load check (15-day vs 365-day rule under audit, Batch 5).',
    min_sip_inr: 500,
    min_lumpsum_inr: 500,
    investment_objective:
      'To achieve long term capital appreciation by investing in quality mid-cap companies having long-term competitive advantages and strong management pedigree following the QGLP framework.',
    asOfDate: '2026-09-30',
    disclosureSource: `AMFI snapshot (${AMFI_SNAPSHOT_DATE}, Direct Plan Growth verified via AMFI historical record) & AMC Factsheet`,
    isStatutoryDisclosure: true,
    identityStatus: presetIdentity(127042, 'Motilal Oswal Midcap Fund', 'INF247L01445'),
    manager: {
      name: 'Niket Shah',
      tenureYears: 8.6,
      overallExpYears: 16,
      education: 'Master of Management Studies (Finance)',
      bio: 'Leads mid-cap research at Motilal Oswal. Follows high-conviction focused stock-picking with emphasis on growth and pricing power.',
      otherFundsManaged: ['Motilal Oswal Flexi Cap Fund', 'Motilal Oswal Small Cap Fund'],
    },
    holdingsStatus: {
      available: true,
      asOfDate: '2026-09-30',
      source: 'Motilal Oswal Top Disclosed Equity Positions (partial coverage; exchange ADTV not ingested)',
      partialCoverage: true,
      disclosedWeightPct: 62.7,
      unknownWeightPct: 37.3,
      coverageThresholdPct: 100,
      reason: 'Disclosed subset sums to 62.70% of AUM (37.30% unknown/undisclosed). Full security-level monthly disclosure & exchange 30D ADTV ingestion scheduled in Batch 5.',
    },
    holdings: [
      { isin: 'INE982J01020', name: 'One 97 Communications (Paytm)', sector: 'Financial Services', mcap: 'Mid Cap', weight: 9.2, adtv_cr: null },
      { isin: 'INE303R01014', name: 'Kalyan Jewellers India Ltd', sector: 'Consumer Goods', mcap: 'Mid Cap', weight: 8.4, adtv_cr: null },
      { isin: 'INE758T01015', name: 'Eternal Ltd (formerly Zomato)', sector: 'Technology', mcap: 'Large Cap', weight: 7.6, adtv_cr: null },
      { isin: 'INE262H01013', name: 'Persistent Systems Ltd', sector: 'Technology', mcap: 'Mid Cap', weight: 6.1, adtv_cr: null },
      { isin: 'INE591G01017', name: 'Coforge Ltd', sector: 'Technology', mcap: 'Mid Cap', weight: 5.4, adtv_cr: null },
      { isin: 'INE455K01017', name: 'Polycab India Ltd', sector: 'Industrials', mcap: 'Mid Cap', weight: 4.9, adtv_cr: null },
      { isin: 'INE849A01020', name: 'Trent Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 4.5, adtv_cr: null },
      { isin: 'INE027H01010', name: 'Max Healthcare Institute Ltd', sector: 'Healthcare', mcap: 'Large Cap', weight: 4.2, adtv_cr: null },
      { isin: 'INE974X01010', name: 'Tube Investments of India', sector: 'Industrials', mcap: 'Mid Cap', weight: 3.9, adtv_cr: null },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 8.5, adtv_cr: null },
    ],
  },

  // 3. BLOCKED CROSS-SCHEME MISMATCH (Audited HDFC Top 100 vs AMFI 118989 HDFC Mid Cap)
  118989: {
    scheme_code: 118989,
    name: 'Blocked Preset 118989 (Audited HDFC Top 100 vs AMFI HDFC Mid Cap)',
    category: 'Unresolved Scheme Mismatch',
    asset_class: 'Equity',
    fund_house: 'HDFC Mutual Fund',
    benchmark_symbol: '^NSEI',
    isin: null,
    plan: 'Direct',
    option: 'Growth',
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
    asOfDate: AMFI_SNAPSHOT_DATE,
    disclosureSource: `Quarantined by AMFI Snapshot (${AMFI_SNAPSHOT_DATE})`,
    isStatutoryDisclosure: false,
    identityStatus: presetIdentity(118989, 'HDFC Top 100 Large Cap Fund', 'INF179K01BE2'),
    manager: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason: PRESET_RECONCILIATION_TABLE[118989].reason,
    },
    holdings: null,
  },

  // 4. Small Cap — ISIN reconciled to INF204K01K15
  118778: {
    scheme_code: 118778,
    name: 'Nippon India Small Cap Fund',
    category: 'Small Cap',
    asset_class: 'Equity',
    fund_house: 'Nippon India Mutual Fund',
    benchmark_symbol: 'NIFTYSMALLCAP250.NS',
    isin: 'INF204K01K15',
    plan: 'Direct',
    option: 'Growth',
    aum_cr: 63800.0,
    aum_as_of: '2026-09-30',
    inception_date: '2010-09-16',
    expense_ratio_direct: 0.69,
    expense_ratio_regular: 1.49,
    turnover_ratio_pct: 22.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 1 year (verify current addendum in Batch 5).',
    min_sip_inr: 100,
    min_lumpsum_inr: 5000,
    investment_objective:
      'To generate long-term capital appreciation by investing predominantly in equity and equity-related instruments of small cap companies.',
    asOfDate: '2026-09-30',
    disclosureSource: `AMFI snapshot (${AMFI_SNAPSHOT_DATE}, ISIN reconciled to INF204K01K15) & AMC Factsheet`,
    isStatutoryDisclosure: true,
    identityStatus: presetIdentity(118778, 'Nippon India Small Cap Fund', 'INF204K01K15'),
    manager: {
      name: 'Samir Rachh',
      tenureYears: 7.8,
      overallExpYears: 26,
      education: 'B.Com, MMS (Finance)',
      bio: 'Employs a deeply diversified portfolio approach to manage capacity and liquidity across small-cap mandates.',
      otherFundsManaged: ['Nippon India Growth Fund'],
    },
    holdingsStatus: {
      available: true,
      asOfDate: '2026-09-30',
      source: 'Nippon India Top Disclosed Equity Positions (partial coverage; exchange ADTV not ingested)',
      partialCoverage: true,
      disclosedWeightPct: 33.1,
      unknownWeightPct: 66.9,
      coverageThresholdPct: 100,
      reason: 'Disclosed subset sums to 33.10% of AUM (66.90% unknown/undisclosed). Full security-level monthly disclosure & exchange 30D ADTV ingestion scheduled in Batch 5.',
    },
    holdings: [
      { isin: 'INE974X01010', name: 'Tube Investments of India', sector: 'Industrials', mcap: 'Mid Cap', weight: 4.1, adtv_cr: null },
      { isin: 'INE127D01025', name: 'HDFC Asset Management', sector: 'Financial Services', mcap: 'Large Cap', weight: 3.4, adtv_cr: null },
      { isin: 'INE372A01015', name: 'Apar Industries Ltd', sector: 'Industrials', mcap: 'Small Cap', weight: 2.9, adtv_cr: null },
      { isin: 'INE036D01028', name: 'Karur Vysya Bank Ltd', sector: 'Financial Services', mcap: 'Small Cap', weight: 2.7, adtv_cr: null },
      { isin: 'INE741K01010', name: 'CreditAccess Grameen', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.5, adtv_cr: null },
      { isin: 'INE745G01035', name: 'Multi Commodity Exchange', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.4, adtv_cr: null },
      { isin: 'INE094A01015', name: 'Hindustan Petroleum', sector: 'Energy', mcap: 'Mid Cap', weight: 2.2, adtv_cr: null },
      { isin: 'INE121A01024', name: 'Cholamandalam Inv & Fin', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.1, adtv_cr: null },
      { isin: 'INE455K01017', name: 'Polycab India Ltd', sector: 'Industrials', mcap: 'Mid Cap', weight: 1.95, adtv_cr: null },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 8.85, adtv_cr: null },
    ],
  },

  // 5. Large Cap — Reconciled renamed SBI Large Cap Fund (formerly SBI Bluechip) + INF200K01QX4
  119598: {
    scheme_code: 119598,
    name: 'SBI Large Cap Fund',
    category: 'Large Cap',
    asset_class: 'Equity',
    fund_house: 'SBI Mutual Fund',
    benchmark_symbol: '^NSEI',
    isin: 'INF200K01QX4',
    plan: 'Direct',
    option: 'Growth',
    aum_cr: 52400.0,
    aum_as_of: '2026-09-30',
    inception_date: '2006-02-14',
    expense_ratio_direct: 0.86,
    expense_ratio_regular: 1.54,
    turnover_ratio_pct: 19.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 1 year; Nil thereafter.',
    min_sip_inr: 500,
    min_lumpsum_inr: 5000,
    investment_objective:
      'To provide investors with opportunities for long-term growth in capital through active management of investments in a diversified basket of large cap equity stocks.',
    asOfDate: '2026-09-30',
    disclosureSource: `AMFI snapshot (${AMFI_SNAPSHOT_DATE}, reconciled to SBI Large Cap Fund / INF200K01QX4) & AMC Factsheet`,
    isStatutoryDisclosure: true,
    identityStatus: presetIdentity(119598, 'SBI Large Cap Fund', 'INF200K01QX4', [
      'SBI Bluechip Fund',
      'SBI Bluechip Large Cap Fund',
    ]),
    manager: {
      name: 'Saurabh Pant (Fund Manager)',
      tenureYears: 4.1,
      overallExpYears: 20,
      education: 'B.Com, Chartered Accountant (CA)',
      bio: 'Seasoned equity portfolio manager steering SBI Large Cap (formerly SBI Bluechip) with focus on ROCE and governance.',
      otherFundsManaged: ['SBI Infrastructure Fund'],
    },
    holdingsStatus: {
      available: true,
      asOfDate: '2026-09-30',
      source: 'SBI MF Top Disclosed Equity Positions (partial coverage; exchange ADTV not ingested)',
      partialCoverage: true,
      disclosedWeightPct: 68.0,
      unknownWeightPct: 32.0,
      coverageThresholdPct: 100,
      reason: 'Disclosed subset sums to 68.00% of AUM (32.00% unknown/undisclosed). Full security-level monthly disclosure & exchange 30D ADTV ingestion scheduled in Batch 5.',
    },
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 9.1, adtv_cr: null },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 8.4, adtv_cr: null },
      { isin: 'INE002A01018', name: 'Reliance Industries Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 7.9, adtv_cr: null },
      { isin: 'INE009A01021', name: 'Infosys Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 6.8, adtv_cr: null },
      { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd', sector: 'Industrials', mcap: 'Large Cap', weight: 5.9, adtv_cr: null },
      { isin: 'INE154A01025', name: 'ITC Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 4.5, adtv_cr: null },
      { isin: 'INE467B01029', name: 'Tata Consultancy Services', sector: 'Technology', mcap: 'Large Cap', weight: 4.3, adtv_cr: null },
      { isin: 'INE062A01020', name: 'State Bank of India', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.2, adtv_cr: null },
      { isin: 'INE238A01034', name: 'Axis Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 3.8, adtv_cr: null },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 13.1, adtv_cr: null },
    ],
  },

  // 6. BLOCKED CROSS-SCHEME MISMATCH (Audited ICICI Corporate Bond vs AMFI 120503 Axis ELSS)
  120503: {
    scheme_code: 120503,
    name: 'Blocked Preset 120503 (Audited ICICI Corporate Bond vs AMFI Axis ELSS)',
    category: 'Unresolved Scheme Mismatch',
    asset_class: 'Debt',
    fund_house: 'Unresolved Mismatch',
    benchmark_symbol: 'CRISIL_COMP_BOND',
    isin: null,
    plan: 'Direct',
    option: 'Growth',
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
    macaulay_duration: null,
    modified_duration: null,
    ytm: null,
    avg_maturity_years: null,
    credit_profile: null,
    asOfDate: AMFI_SNAPSHOT_DATE,
    disclosureSource: `Quarantined by AMFI Snapshot (${AMFI_SNAPSHOT_DATE})`,
    isStatutoryDisclosure: false,
    identityStatus: presetIdentity(120503, 'ICICI Prudential Corporate Bond Fund', 'INF109K01AQ5'),
    manager: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason: PRESET_RECONCILIATION_TABLE[120503].reason,
    },
    holdings: null,
  },

  // 7. BLOCKED CROSS-SCHEME MISMATCH (Audited ICICI Balanced Advantage vs AMFI 120586 ICICI Large Cap)
  120586: {
    scheme_code: 120586,
    name: 'Blocked Preset 120586 (Audited ICICI Balanced Advantage vs AMFI ICICI Large Cap)',
    category: 'Unresolved Scheme Mismatch',
    asset_class: 'Hybrid',
    fund_house: 'ICICI Prudential AMC',
    benchmark_symbol: '^CRSLDX',
    isin: null,
    plan: 'Direct',
    option: 'Growth',
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
    macaulay_duration: null,
    modified_duration: null,
    ytm: null,
    avg_maturity_years: null,
    credit_profile: null,
    asOfDate: AMFI_SNAPSHOT_DATE,
    disclosureSource: `Quarantined by AMFI Snapshot (${AMFI_SNAPSHOT_DATE})`,
    isStatutoryDisclosure: false,
    identityStatus: presetIdentity(120586, 'ICICI Prudential Balanced Advantage Fund', 'INF109K01844'),
    manager: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason: PRESET_RECONCILIATION_TABLE[120586].reason,
    },
    holdings: null,
  },

  // 8. BLOCKED MISSING / STALE SCHEME (Audited Nippon Gold Savings vs absent/stale 2013 Reliance Natural Resources)
  118753: {
    scheme_code: 118753,
    name: 'Blocked Preset 118753 (Audited Nippon Gold Savings — Missing in AMFI Snapshot)',
    category: 'Unresolved Missing Scheme',
    asset_class: 'Commodity',
    fund_house: 'Unresolved Missing',
    benchmark_symbol: 'GOLD_DOMESTIC',
    isin: null,
    plan: 'Direct',
    option: 'Growth',
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
    asOfDate: AMFI_SNAPSHOT_DATE,
    disclosureSource: `Quarantined by AMFI Snapshot (${AMFI_SNAPSHOT_DATE})`,
    isStatutoryDisclosure: false,
    identityStatus: presetIdentity(118753, 'Nippon India Gold Savings Fund', 'INF204K01585'),
    manager: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason: PRESET_RECONCILIATION_TABLE[118753].reason,
    },
    holdings: null,
  },

  // 9. BLOCKED UNVERIFIED PLAN/OPTION & ISIN MISMATCH (Motilal Oswal Nasdaq 100 FoF)
  145552: {
    scheme_code: 145552,
    name: 'Blocked Preset 145552 (MO Nasdaq 100 FoF — Plan/Option Unverified)',
    category: 'Unverified Plan / ISIN Mismatch',
    asset_class: 'International',
    fund_house: 'Motilal Oswal AMC',
    benchmark_symbol: 'UNAVAILABLE_INTL',
    isin: null,
    plan: 'Unknown',
    option: 'Unknown',
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
    asOfDate: AMFI_SNAPSHOT_DATE,
    disclosureSource: `Quarantined by AMFI Snapshot (${AMFI_SNAPSHOT_DATE})`,
    isStatutoryDisclosure: false,
    identityStatus: presetIdentity(145552, 'Motilal Oswal Nasdaq 100 FoF', 'INF247L01786'),
    manager: null,
    holdingsStatus: {
      available: false,
      asOfDate: null,
      source: null,
      partialCoverage: false,
      disclosedWeightPct: null,
      unknownWeightPct: null,
      coverageThresholdPct: 100,
      reason: PRESET_RECONCILIATION_TABLE[145552].reason,
    },
    holdings: null,
  },
};

export function getBenchmarkSeries(
  symbol: string = '^CRSLDX',
  externalVerified?: ExternalBenchmarkInput | null
): NavPoint[] {
  return resolveBenchmarkSeries(symbol, externalVerified).series;
}

export interface FetchLiveMfOptions {
  requestedCode?: number;
  expectedName?: string;
  expectedPlan?: PlanType;
  expectedOption?: OptionType;
  expectedIsin?: string | null;
  referenceDate?: string;
  valuationCutoffDate?: string;
  maxStaleDays?: number;
  expectedMeta?: FundMeta;
  trustedRegistry?: Record<number, TrustedRegistryEntry>;
  corporateActions?: CorporateActionRecord[];
  seriesIsin?: string | null;
}

function buildErrorSeries(
  schemeCode: number,
  reason: string,
  expectedMeta?: FundMeta,
  valuationCutoffDate?: string
): ValidatedNavSeries {
  const cutoffIso = valuationCutoffDate || getIndiaValuationDateIso();
  const baseIdentity = expectedMeta?.identityStatus
    ? {
        ...expectedMeta.identityStatus,
        verified: false,
        status: 'provider_error' as const,
        providerSchemeCode: null,
        providerName: null,
        providerPlan: 'Unknown' as const,
        providerOption: 'Unknown' as const,
        providerIsin: null,
        providerSource: 'unavailable' as const,
        reason,
      }
    : null;

  return {
    schemeCode,
    points: [],
    rawObservations: [],
    identity: baseIdentity,
    validation: {
      status: 'unavailable',
      usable: false,
      provider: 'api.mfapi.in',
      fetchedAt: new Date().toISOString(),
      valuationCutoffDate: cutoffIso,
      totalRawCount: 0,
      validCount: 0,
      rejectedInvalidDateCount: 0,
      rejectedNonPositiveCount: 0,
      rejectedNonFiniteCount: 0,
      rejectedPostCutoffCount: 0,
      duplicateIdenticalCount: 0,
      duplicateConflicts: [],
      earliestDate: null,
      latestDate: null,
      isStale: false,
      staleDays: null,
      corporateActionBreaks: [],
      quarantinedFromBreak: false,
      unavailableReason: reason,
      warnings: [reason],
      rejectedPayloadDiagnostics: {
        requestedSchemeCode: schemeCode,
        returnedSchemeCode: null,
        returnedSchemeName: null,
        returnedIsin: null,
        reason,
        totalRawCount: 0,
        sampleObservations: [],
      },
    },
  };
}

/**
 * Processes an already-fetched MFAPI /mf/{code} JSON payload through strict identity + NAV validation.
 */
export function validateMfapiPayload(
  schemeCode: number,
  payload: { meta?: ProviderSchemeMeta; data?: { date: string; nav: string | number }[]; status?: string },
  options: FetchLiveMfOptions = {}
): ValidatedNavSeries {
  const requestedCode = options.requestedCode ?? schemeCode;
  const providerMeta = payload?.meta;
  const expectedMeta = options.expectedMeta ?? PRESET_FUNDS[requestedCode];
  const trustedRegistry = options.trustedRegistry ?? TRUSTED_AMFI_REGISTRY;

  let identity = expectedMeta
    ? validateSchemeIdentity(
        {
          scheme_code: expectedMeta.scheme_code,
          name: expectedMeta.identityStatus.expectedName,
          plan: expectedMeta.identityStatus.expectedPlan,
          option: expectedMeta.identityStatus.expectedOption,
          isin: expectedMeta.identityStatus.expectedIsin,
          acceptedAliases:
            requestedCode === 119598
              ? ['SBI Bluechip Fund', 'SBI Bluechip Large Cap Fund', 'SBI Large Cap Fund']
              : [],
        },
        providerMeta || null,
        trustedRegistry
      )
    : validateDiscoveredSchemeIdentity(providerMeta || null, {
        requestedCode,
        expectedName: options.expectedName,
        expectedPlan: options.expectedPlan,
        expectedOption: options.expectedOption,
        expectedIsin: options.expectedIsin,
        trustedRegistry,
      });

  // Also ensure any preset blocked in the reconciliation table remains blocked even if caller didn't pass expectedMeta
  const rec = PRESET_RECONCILIATION_TABLE[requestedCode];
  if (rec && !rec.selectable && identity.verified) {
    identity = validateSchemeIdentity(
      {
        scheme_code: rec.scheme_code,
        name: rec.auditedPresetName,
        plan: 'Direct',
        option: 'Growth',
        isin: rec.auditedPresetIsin,
      },
      providerMeta || null,
      trustedRegistry
    );
  }

  return validateRawNavSeries(payload?.data, {
    schemeCode: requestedCode,
    provider: 'api.mfapi.in',
    referenceDate: options.referenceDate,
    valuationCutoffDate: options.valuationCutoffDate,
    maxStaleDays: options.maxStaleDays ?? 14,
    identity,
    returnedSchemeCode: providerMeta?.scheme_code != null ? Number(providerMeta.scheme_code) : null,
    returnedSchemeName: providerMeta?.scheme_name ?? null,
    returnedIsin: (providerMeta?.isin_growth || providerMeta?.isin_div_reinvestment || null) ?? null,
    corporateActions: options.corporateActions,
    seriesIsin: options.seriesIsin,
  });
}

/**
 * Fetches historical daily NAV series from mfapi.in with strict identity verification,
 * calendar-date checks, finite positive NAV filtering, duplicate conflict blocking,
 * India valuation cutoff, freshness enforcement, and corporate-action break detection.
 * NEVER fabricates synthetic NAV points on error or mismatch.
 */
export async function fetchLiveMfNav(
  schemeCode: number,
  options: FetchLiveMfOptions = {}
): Promise<ValidatedNavSeries> {
  const expectedMeta = options.expectedMeta ?? PRESET_FUNDS[schemeCode];
  const cutoffIso = options.valuationCutoffDate || options.referenceDate || getIndiaValuationDateIso();

  // Fast-fail blocked presets while documenting exact AMFI reconciliation conflict
  const rec = PRESET_RECONCILIATION_TABLE[schemeCode];
  if (rec && !rec.selectable) {
    const blockedIdentity = validateSchemeIdentity(
      {
        scheme_code: rec.scheme_code,
        name: rec.auditedPresetName,
        plan: 'Direct',
        option: 'Growth',
        isin: rec.auditedPresetIsin,
      },
      null,
      options.trustedRegistry ?? TRUSTED_AMFI_REGISTRY
    );
    return {
      schemeCode,
      points: [],
      rawObservations: [],
      identity: blockedIdentity,
      validation: {
        status: 'unavailable',
        usable: false,
        provider: `AMFI Snapshot (${AMFI_SNAPSHOT_SOURCE})`,
        fetchedAt: new Date().toISOString(),
        valuationCutoffDate: cutoffIso,
        totalRawCount: 0,
        validCount: 0,
        rejectedInvalidDateCount: 0,
        rejectedNonPositiveCount: 0,
        rejectedNonFiniteCount: 0,
        rejectedPostCutoffCount: 0,
        duplicateIdenticalCount: 0,
        duplicateConflicts: [],
        earliestDate: null,
        latestDate: null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: rec.reason,
        warnings: [rec.reason],
        rejectedPayloadDiagnostics: {
          requestedSchemeCode: schemeCode,
          returnedSchemeCode: null,
          returnedSchemeName: rec.amfiName,
          returnedIsin: rec.amfiIsin,
          reason: rec.reason,
          totalRawCount: 0,
          sampleObservations: [],
        },
      },
    };
  }

  const endpoints = [`/api/mf/mf/${schemeCode}`, `https://api.mfapi.in/mf/${schemeCode}`];
  let lastError = `Unable to retrieve scheme ${schemeCode} from mfapi.in.`;

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) {
        lastError = `HTTP ${resp.status} (${resp.statusText || 'Error'}) from ${url}`;
        continue;
      }
      const json = await resp.json();
      if (!json || typeof json !== 'object') {
        lastError = `Malformed JSON response from ${url}`;
        continue;
      }
      return validateMfapiPayload(schemeCode, json, { ...options, expectedMeta });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return buildErrorSeries(schemeCode, `Unavailable: ${lastError}`, expectedMeta, cutoffIso);
}
