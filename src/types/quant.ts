export type AssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Commodity' | 'International';

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
  adtv_cr: number; // 30-day Average Daily Trading Volume in Crores INR
  creditRating?: string;
}

export interface FundManagerInfo {
  name: string;
  tenureYears: number;
  overallExpYears: number;
  education: string;
  bio: string;
  otherFundsManaged: string[];
}

export interface FundMeta {
  scheme_code: number;
  name: string;
  category: string;
  asset_class: AssetClass;
  fund_house: string;
  benchmark_symbol: string;
  isin: string;
  aum_cr: number;
  inception_date: string;
  expense_ratio_direct: number;
  expense_ratio_regular: number;
  turnover_ratio_pct: number;
  riskometer: 'Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High';
  exit_load: string;
  min_sip_inr: number;
  min_lumpsum_inr: number;
  investment_objective: string;
  manager: FundManagerInfo;
  
  // Debt specific metrics
  macaulay_duration?: number; // in years
  modified_duration?: number;
  ytm?: number; // annual yield
  avg_maturity_years?: number;
  credit_profile?: CreditProfile;

  holdings: FundHolding[];
  asOfDate?: string;
  isStatutoryDisclosure?: boolean;
}

export interface NavPoint {
  date: string;
  nav: number;
}

export interface TrailingCagr {
  [key: string]: number | undefined;
  '1Y'?: number;
  '3Y'?: number;
  '5Y'?: number;
  '7Y'?: number;
  '10Y'?: number;
}

export interface RollingDistribution {
  windowYears: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
  std: number;
  count: number;
  pctPositive: number;
  pctNegative: number;
  series: { date: string; value: number }[];
}

export interface RiskMetrics {
  fundName: string;
  schemeCode: number;
  category: string;
  assetClass: AssetClass;
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  beta: number;
  jensensAlpha: number;
  rSquared: number;
  trackingError: number;
  informationRatio: number;
  maxDrawdown: number;
  recoveryDays: number;
  calmarRatio: number;
  upsideCapture: number;
  downsideCapture: number;
  peakDate: string;
  maxDdDate: string;
  recoveryDate: string;

  // Debt specific metrics if applicable
  ytm?: number;
  macaulayDuration?: number;
  modifiedDuration?: number;
  avgMaturity?: number;
}

export interface LiquidityStressResult {
  days25Prorata: number;
  days50Prorata: number;
  days25Waterfall: number;
  days50Waterfall: number;
  pctLiquidUnder3Days: number;
  pctLiquid3To7Days: number;
  pctIlliquidOver10Days: number;
  holdings: {
    isin: string;
    name: string;
    weight: number;
    positionCr: number;
    adtvCr: number;
    daysToLiquidate: number;
  }[];
}

export interface DurationShockPoint {
  shockBps: number;
  durationImpactPct: number;
  convexityBenefitPct: number;
  totalNavChangePct: number;
  simulatedNav: number;
}

export interface SipSimulationResult {
  monthlyAmount: number;
  totalInvested: number;
  totalCorpus: number;
  absoluteProfit: number;
  xirrPct: number;
  timeline: { date: string; invested: number; corpus: number }[];
}
