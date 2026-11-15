export type AssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Commodity' | 'International';

export type PlanType = 'Direct' | 'Regular' | 'ETF' | 'Unknown';
export type OptionType = 'Growth' | 'IDCW' | 'Unknown';

export type IdentityStatus =
  | 'verified'
  | 'reconciled_isin'
  | 'code_mismatch'
  | 'cross_scheme_mismatch'
  | 'isin_mismatch'
  | 'unresolved_isin'
  | 'plan_mismatch'
  | 'plan_unverified'
  | 'missing_from_registry'
  | 'stale'
  | 'provider_error';

export interface SchemeIdentityAudit {
  scheme_code: number;
  verified: boolean;
  status: IdentityStatus;
  expectedName: string;
  expectedPlan: PlanType;
  expectedOption: OptionType;
  expectedIsin: string | null;
  providerName: string | null;
  providerPlan: PlanType;
  providerOption: OptionType;
  providerIsin: string | null;
  providerSource: 'amfi_registry' | 'mfapi' | 'unavailable';
  registryAsOfDate?: string | null;
  reason: string | null;
}

export interface PresetReconciliationRecord {
  scheme_code: number;
  auditedPresetName: string;
  auditedPresetIsin: string;
  amfiName: string | null;
  amfiIsin: string | null;
  amfiPlan: string | null;
  amfiOption: string | null;
  amfiNav: number | null;
  amfiDate: string;
  resolutionStatus:
    | 'verified'
    | 'reconciled_isin'
    | 'unavailable_mismatch'
    | 'unavailable_missing'
    | 'unavailable_unverified_plan';
  selectable: boolean;
  reason: string;
}

export interface CorporateActionBreak {
  prevDate: string;
  prevNav: number;
  date: string;
  nav: number;
  pctChange: number;
  ratio: number;
  status: 'unresolved_quarantined';
  explanation: string;
}

export interface RawNavObservation {
  rawDate: string;
  date: string | null;
  rawNav: string | number;
  nav: number | null;
  source: string;
  status:
    | 'valid'
    | 'invalid_date'
    | 'nonpositive_nav'
    | 'nonfinite_nav'
    | 'duplicate_identical'
    | 'duplicate_conflict';
}

export interface NavValidationReport {
  status: 'valid' | 'unavailable' | 'quarantined_partial' | 'stale';
  usable: boolean;
  provider: string;
  fetchedAt: string;
  totalRawCount: number;
  validCount: number;
  rejectedInvalidDateCount: number;
  rejectedNonPositiveCount: number;
  rejectedNonFiniteCount: number;
  duplicateIdenticalCount: number;
  duplicateConflicts: { date: string; values: number[] }[];
  earliestDate: string | null;
  latestDate: string | null;
  isStale: boolean;
  staleDays: number | null;
  corporateActionBreaks: CorporateActionBreak[];
  quarantinedFromBreak: boolean;
  unavailableReason: string | null;
  warnings: string[];
}

export interface ValidatedNavSeries {
  schemeCode: number;
  points: NavPoint[];
  rawObservations: RawNavObservation[];
  validation: NavValidationReport;
  identity: SchemeIdentityAudit | null;
}

export interface CreditProfile {
  sovereignPct: number;
  aaaPct: number;
  aaPct: number;
  aAndBelowPct: number;
  cashPct: number;
}

export interface FundHolding {
  isin: string;
  name: string;
  sector: string;
  mcap: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Debt / Fixed Income' | 'Cash / Sovereign';
  weight: number;
  adtv_cr: number | null;
  creditRating?: string;
}

export interface FundManagerInfo {
  name: string;
  tenureYears: number | null;
  overallExpYears: number | null;
  education: string | null;
  bio: string | null;
  otherFundsManaged: string[];
}

export interface HoldingsStatus {
  available: boolean;
  asOfDate: string | null;
  source: string | null;
  partialCoverage: boolean;
  reason: string | null;
}

export interface FundMeta {
  scheme_code: number;
  name: string;
  category: string;
  asset_class: AssetClass;
  fund_house: string;
  benchmark_symbol: string;
  isin: string | null;
  plan: PlanType;
  option: OptionType;
  aum_cr: number | null;
  aum_as_of?: string | null;
  inception_date: string | null;
  expense_ratio_direct: number | null;
  expense_ratio_regular: number | null;
  turnover_ratio_pct: number | null;
  riskometer: 'Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High' | null;
  exit_load: string | null;
  min_sip_inr: number | null;
  min_lumpsum_inr: number | null;
  investment_objective: string | null;
  manager: FundManagerInfo | null;

  // Debt specific metrics
  macaulay_duration?: number | null;
  modified_duration?: number | null;
  ytm?: number | null;
  avg_maturity_years?: number | null;
  credit_profile?: CreditProfile | null;

  holdings: FundHolding[] | null;
  holdingsStatus: HoldingsStatus;
  identityStatus: SchemeIdentityAudit;
  disclosureSource: string | null;
  asOfDate: string | null;
  isStatutoryDisclosure: boolean;
}

export interface NavPoint {
  date: string;
  nav: number;
}

export interface BenchmarkStatus {
  symbol: string;
  name: string;
  variant: 'TRI' | 'PRI' | 'Index' | 'Unavailable';
  available: boolean;
  source: string | null;
  asOfDate: string | null;
  reason: string | null;
  series: NavPoint[];
}

export interface TrailingCagr {
  [key: string]: number | null | undefined;
  '3M'?: number | null;
  '6M'?: number | null;
  '1Y'?: number | null;
  '3Y'?: number | null;
  '5Y'?: number | null;
  '7Y'?: number | null;
  '10Y'?: number | null;
}

export interface TrailingCagrResult {
  values: TrailingCagr;
  unavailableReasons: Record<string, string>;
}

export interface RollingDistribution {
  windowYears: number;
  available: boolean;
  unavailableReason: string | null;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  q25: number | null;
  q75: number | null;
  std: number | null;
  count: number;
  quarantinedWindowsCount?: number;
  pctPositive: number | null;
  pctNegative: number | null;
  series: { date: string; value: number }[];
}

export interface RiskMetrics {
  fundName: string;
  schemeCode: number;
  category: string;
  assetClass: AssetClass;
  fundOnlyAvailable: boolean;
  benchmarkRelativeAvailable: boolean;
  rfAnnualApplied: number;
  observationCount: number;
  startDate: string | null;
  endDate: string | null;
  unavailableReasons: Record<string, string>;

  cagr: number | null;
  volatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  beta: number | null;
  jensensAlpha: number | null;
  rSquared: number | null;
  trackingError: number | null;
  informationRatio: number | null;
  maxDrawdown: number | null;
  recoveryDays: number | null;
  calmarRatio: number | null;
  upsideCapture: number | null;
  downsideCapture: number | null;
  peakDate: string | null;
  maxDdDate: string | null;
  recoveryDate: string | null;

  // Debt specific metrics if applicable
  ytm?: number | null;
  macaulayDuration?: number | null;
  modifiedDuration?: number | null;
  avgMaturity?: number | null;
}

export interface LiquidityStressResult {
  available: boolean;
  reason: string | null;
  days25Prorata: number | null;
  days50Prorata: number | null;
  days25Waterfall: number | null;
  days50Waterfall: number | null;
  pctLiquidUnder3Days: number | null;
  pctLiquid3To7Days: number | null;
  pctIlliquidOver10Days: number | null;
  holdings: {
    isin: string;
    name: string;
    weight: number;
    positionCr: number;
    adtvCr: number | null;
    daysToLiquidate: number | null;
  }[];
}

export interface DurationShockPoint {
  shockBps: number;
  durationImpactPct: number;
  convexityBenefitPct: number;
  totalNavChangePct: number;
  simulatedNav: number;
}

export interface DurationSensitivityResult {
  available: boolean;
  reason: string | null;
  points: DurationShockPoint[];
}

export interface SipSimulationResult {
  available: boolean;
  reason: string | null;
  monthlyAmount: number;
  totalInvested: number | null;
  totalCorpus: number | null;
  absoluteProfit: number | null;
  xirrPct: number | null;
  timeline: { date: string; invested: number; corpus: number }[];
}
