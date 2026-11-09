export interface FundHolding {
  isin: string;
  name: string;
  sector: string;
  mcap: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Debt / Fixed Income' | 'Cash / Sovereign';
  weight: number;
  adtv_cr: number; // 30-day Average Daily Trading Volume in Crores INR
}

export interface FundMeta {
  scheme_code: number;
  name: string;
  category: string;
  benchmark_symbol: string;
  isin: string;
  aum_cr: number;
  macaulay_duration: number; // in years
  ytm?: number; // annual yield
  holdings: FundHolding[];
}

export interface NavPoint {
  date: string;
  nav: number;
}

export interface TrailingCagr {
  '1Y'?: number;
  '3Y'?: number;
  '5Y'?: number;
  '7Y'?: number;
}

export interface RollingDistribution {
  mean: number;
  median: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
  std: number;
  count: number;
  series: { date: string; value: number }[];
}

export interface RiskMetrics {
  fundName: string;
  schemeCode: number;
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
  peakDate: string;
  maxDdDate: string;
  recoveryDate: string;
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
