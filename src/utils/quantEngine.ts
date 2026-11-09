import {
  FundHolding,
  NavPoint,
  TrailingCagr,
  RollingDistribution,
  RiskMetrics,
  LiquidityStressResult,
  DurationShockPoint,
} from '../types/quant';

/**
 * Annualized CAGR for specific periods: (P_end / P_start) ** (1 / years) - 1
 */
export function computeTrailingCagr(
  series: NavPoint[],
  periods: number[] = [1, 3, 5, 7]
): TrailingCagr {
  const result: TrailingCagr = {};
  if (!series || series.length < 10) return result;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const endPoint = sorted[sorted.length - 1];
  const endDate = new Date(endPoint.date);

  for (const yrs of periods) {
    const targetDate = new Date(endDate);
    targetDate.setFullYear(targetDate.getFullYear() - yrs);
    const targetIso = targetDate.toISOString().split('T')[0];

    // Find the closest point on or before targetIso
    let startPoint: NavPoint | undefined;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].date <= targetIso) {
        startPoint = sorted[i];
        break;
      }
    }

    if (startPoint && startPoint.nav > 0 && endPoint.nav > 0) {
      const cagr = Math.pow(endPoint.nav / startPoint.nav, 1.0 / yrs) - 1.0;
      if (yrs === 1) result['1Y'] = Number((cagr * 100).toFixed(2));
      if (yrs === 3) result['3Y'] = Number((cagr * 100).toFixed(2));
      if (yrs === 5) result['5Y'] = Number((cagr * 100).toFixed(2));
      if (yrs === 7) result['7Y'] = Number((cagr * 100).toFixed(2));
    } else {
      // If history is less than requested years, approximate annualized if >= 1 year
      const firstPoint = sorted[0];
      const days = (endDate.getTime() - new Date(firstPoint.date).getTime()) / 86400000;
      if (days >= 300) {
        const actualYrs = days / 365.25;
        const cagr = Math.pow(endPoint.nav / firstPoint.nav, 1.0 / actualYrs) - 1.0;
        if (yrs === 1 && !result['1Y']) result['1Y'] = Number((cagr * 100).toFixed(2));
        if (yrs === 3 && actualYrs >= 2) result['3Y'] = Number((cagr * 100).toFixed(2));
        if (yrs === 5 && actualYrs >= 4) result['5Y'] = Number((cagr * 100).toFixed(2));
      }
    }
  }

  return result;
}

/**
 * Rolling returns distribution (3Y or 5Y windows): (P_t / P_{t - W}) ** (252 / W) - 1
 */
export function computeRollingReturns(
  series: NavPoint[],
  windowYears: number = 3.0,
  tradingDaysPerYear: number = 252
): RollingDistribution {
  const windowDays = Math.floor(windowYears * tradingDaysPerYear);
  const empty: RollingDistribution = {
    mean: 0,
    median: 0,
    min: 0,
    max: 0,
    q25: 0,
    q75: 0,
    std: 0,
    count: 0,
    series: [],
  };

  if (!series || series.length <= windowDays) return empty;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const rollValues: number[] = [];
  const rollSeries: { date: string; value: number }[] = [];

  for (let i = windowDays; i < sorted.length; i++) {
    const endNav = sorted[i].nav;
    const startNav = sorted[i - windowDays].nav;
    if (startNav > 0 && endNav > 0) {
      const cagr = (Math.pow(endNav / startNav, tradingDaysPerYear / windowDays) - 1.0) * 100.0;
      rollValues.push(cagr);
      rollSeries.push({ date: sorted[i].date, value: Number(cagr.toFixed(2)) });
    }
  }

  if (rollValues.length === 0) return empty;

  rollValues.sort((a, b) => a - b);
  const n = rollValues.length;
  const sum = rollValues.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (rollValues[n / 2 - 1] + rollValues[n / 2]) / 2 : rollValues[Math.floor(n / 2)];
  const min = rollValues[0];
  const max = rollValues[n - 1];
  const q25 = rollValues[Math.floor(n * 0.25)];
  const q75 = rollValues[Math.floor(n * 0.75)];

  const variance = rollValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    q25: Number(q25.toFixed(2)),
    q75: Number(q75.toFixed(2)),
    std: Number(std.toFixed(2)),
    count: n,
    series: rollSeries,
  };
}

/**
 * Benchmark Hit Rate: Percentage of rolling windows where Fund Return > Benchmark Return
 */
export function computeBenchmarkHitRate(
  fundRolling: { date: string; value: number }[],
  benchRolling: { date: string; value: number }[]
): number {
  if (!fundRolling.length || !benchRolling.length) return 0;

  const benchMap = new Map(benchRolling.map((p) => [p.date, p.value]));
  let matched = 0;
  let beatCount = 0;

  for (const f of fundRolling) {
    const bVal = benchMap.get(f.date);
    if (bVal !== undefined) {
      matched++;
      if (f.value > bVal) {
        beatCount++;
      }
    }
  }

  if (matched === 0) return 0;
  return Number(((beatCount / matched) * 100).toFixed(2));
}

/**
 * Risk Ratios, CML metrics, and Drawdowns
 */
export function computeComprehensiveMetrics(
  fundSeries: NavPoint[],
  benchSeries: NavPoint[],
  fundName: string,
  schemeCode: number,
  rfAnnual: number = 0.065
): RiskMetrics {
  const empty: RiskMetrics = {
    fundName,
    schemeCode,
    cagr: 0,
    volatility: 0,
    sharpe: 0,
    sortino: 0,
    beta: 1.0,
    jensensAlpha: 0,
    rSquared: 0,
    trackingError: 0,
    informationRatio: 0,
    maxDrawdown: 0,
    recoveryDays: 0,
    peakDate: '',
    maxDdDate: '',
    recoveryDate: '',
  };

  if (!fundSeries.length || !benchSeries.length) return empty;

  // Align dates
  const benchMap = new Map(benchSeries.map((p) => [p.date, p.nav]));
  const aligned: { date: string; fNav: number; bNav: number }[] = [];

  for (const f of fundSeries) {
    const bNav = benchMap.get(f.date);
    if (bNav !== undefined) {
      aligned.push({ date: f.date, fNav: f.nav, bNav });
    }
  }

  if (aligned.length < 30) return empty;

  // Compute daily returns
  const fReturns: number[] = [];
  const bReturns: number[] = [];
  for (let i = 1; i < aligned.length; i++) {
    const fr = (aligned[i].fNav - aligned[i - 1].fNav) / aligned[i - 1].fNav;
    const br = (aligned[i].bNav - aligned[i - 1].bNav) / aligned[i - 1].bNav;
    fReturns.push(fr);
    bReturns.push(br);
  }

  const n = fReturns.length;
  const fCum = aligned[aligned.length - 1].fNav / aligned[0].fNav;
  const bCum = aligned[aligned.length - 1].bNav / aligned[0].bNav;

  const fAnnReturn = Math.pow(fCum, 252 / n) - 1.0;
  const bAnnReturn = Math.pow(bCum, 252 / n) - 1.0;

  // Volatility
  const fMean = fReturns.reduce((a, b) => a + b, 0) / n;
  const bMean = bReturns.reduce((a, b) => a + b, 0) / n;

  const fVariance = fReturns.reduce((acc, r) => acc + Math.pow(r - fMean, 2), 0) / (n - 1);
  const bVariance = bReturns.reduce((acc, r) => acc + Math.pow(r - bMean, 2), 0) / (n - 1);

  const fAnnVol = Math.sqrt(fVariance) * Math.sqrt(252);

  // Sharpe
  const sharpe = fAnnVol > 1e-6 ? (fAnnReturn - rfAnnual) / fAnnVol : 0;

  // Sortino (Downside semi-deviation relative to daily Rf)
  const rfDaily = Math.pow(1 + rfAnnual, 1 / 252) - 1;
  const downsideVariance =
    fReturns.reduce((acc, r) => {
      const diff = Math.min(0, r - rfDaily);
      return acc + diff * diff;
    }, 0) / n;
  const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortino = downsideDev > 1e-6 ? (fAnnReturn - rfAnnual) / downsideDev : 0;

  // Covariance, Beta & R2
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (fReturns[i] - fMean) * (bReturns[i] - bMean);
  }
  cov = cov / (n - 1);

  const beta = bVariance > 1e-8 ? cov / bVariance : 1.0;
  const expectedReturn = rfAnnual + beta * (bAnnReturn - rfAnnual);
  const jensensAlpha = fAnnReturn - expectedReturn;

  const corr = Math.sqrt(fVariance * bVariance) > 1e-8 ? cov / Math.sqrt(fVariance * bVariance) : 0;
  const rSquared = Math.min(1.0, Math.pow(corr, 2));

  // Tracking Error & Information Ratio
  const excessReturns = fReturns.map((r, i) => r - bReturns[i]);
  const excessMean = excessReturns.reduce((a, b) => a + b, 0) / n;
  const excessVar = excessReturns.reduce((acc, er) => acc + Math.pow(er - excessMean, 2), 0) / (n - 1);
  const trackingError = Math.sqrt(excessVar) * Math.sqrt(252);
  const informationRatio = trackingError > 1e-6 ? (fAnnReturn - bAnnReturn) / trackingError : 0;

  // Max Drawdown & Recovery
  let runningMax = -Infinity;
  let maxDd = 0;
  let maxDdIdx = 0;
  let peakIdx = 0;

  const drawdowns: number[] = [];
  for (let i = 0; i < aligned.length; i++) {
    const nav = aligned[i].fNav;
    if (nav > runningMax) {
      runningMax = nav;
    }
    const dd = (nav - runningMax) / runningMax;
    drawdowns.push(dd);
    if (dd < maxDd) {
      maxDd = dd;
      maxDdIdx = i;
    }
  }

  // Find peak before maxDd
  let prePeakVal = -Infinity;
  for (let i = 0; i <= maxDdIdx; i++) {
    if (aligned[i].fNav >= prePeakVal) {
      prePeakVal = aligned[i].fNav;
      peakIdx = i;
    }
  }

  // Find recovery after maxDd
  let recoveryIdx = -1;
  for (let i = maxDdIdx; i < aligned.length; i++) {
    if (aligned[i].fNav >= prePeakVal) {
      recoveryIdx = i;
      break;
    }
  }

  const peakDate = aligned[peakIdx].date;
  const maxDdDate = aligned[maxDdIdx].date;
  let recoveryDate = 'Ongoing';
  let recoveryDays = Math.round((new Date(aligned[aligned.length - 1].date).getTime() - new Date(peakDate).getTime()) / 86400000);

  if (recoveryIdx !== -1) {
    recoveryDate = aligned[recoveryIdx].date;
    recoveryDays = Math.round((new Date(recoveryDate).getTime() - new Date(peakDate).getTime()) / 86400000);
  }

  return {
    fundName,
    schemeCode,
    cagr: Number((fAnnReturn * 100).toFixed(2)),
    volatility: Number((fAnnVol * 100).toFixed(2)),
    sharpe: Number(sharpe.toFixed(2)),
    sortino: Number(sortino.toFixed(2)),
    beta: Number(beta.toFixed(2)),
    jensensAlpha: Number((jensensAlpha * 100).toFixed(2)),
    rSquared: Number(rSquared.toFixed(3)),
    trackingError: Number((trackingError * 100).toFixed(2)),
    informationRatio: Number(informationRatio.toFixed(2)),
    maxDrawdown: Number((maxDd * 100).toFixed(2)),
    recoveryDays,
    peakDate,
    maxDdDate,
    recoveryDate,
  };
}

/**
 * Pairwise ISIN Overlap: Sum_{shared ISINs} min(Weight_A, Weight_B)
 */
export function computePairwiseOverlap(
  holdingsA: FundHolding[],
  holdingsB: FundHolding[],
  excludeCash: boolean = true
): number {
  if (!holdingsA?.length || !holdingsB?.length) return 0;

  const mapB = new Map(
    holdingsB
      .filter((h) => !excludeCash || h.isin !== 'CASH_EQUIV')
      .map((h) => [h.isin, h.weight])
  );

  let overlap = 0;
  for (const hA of holdingsA) {
    if (excludeCash && hA.isin === 'CASH_EQUIV') continue;
    const wB = mapB.get(hA.isin);
    if (wB !== undefined) {
      overlap += Math.min(hA.weight, wB);
    }
  }

  return Number(overlap.toFixed(2));
}

/**
 * Overlap Matrix across array of funds
 */
export function computeOverlapMatrix(
  funds: { scheme_code: number; name: string; holdings: FundHolding[] }[]
): { names: string[]; matrix: number[][] } {
  const names = funds.map((f) => f.name);
  const n = funds.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 100.0;
      } else if (i < j) {
        const ov = computePairwiseOverlap(funds[i].holdings, funds[j].holdings);
        matrix[i][j] = ov;
        matrix[j][i] = ov;
      }
    }
  }

  return { names, matrix };
}

/**
 * Look-through Market Cap Exposure: Weighted average across selected funds
 */
export function aggregateMarketCapExposure(
  funds: { holdings: FundHolding[] }[],
  weights?: number[]
): { segment: string; weight: number }[] {
  const w = weights || funds.map(() => 1.0 / funds.length);
  const totals: Record<string, number> = {
    'Large Cap': 0,
    'Mid Cap': 0,
    'Small Cap': 0,
    'Debt / Fixed Income': 0,
    'Cash / Sovereign': 0,
  };

  funds.forEach((fund, fIdx) => {
    const fundWeight = w[fIdx];
    fund.holdings.forEach((h) => {
      totals[h.mcap] = (totals[h.mcap] || 0) + fundWeight * h.weight;
    });
  });

  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals).map(([segment, val]) => ({
    segment,
    weight: Number(((val / sum) * 100).toFixed(2)),
  }));
}

/**
 * Look-through Sector Exposures
 */
export function aggregateSectorExposure(
  funds: { holdings: FundHolding[] }[],
  weights?: number[]
): { sector: string; weight: number }[] {
  const w = weights || funds.map(() => 1.0 / funds.length);
  const totals: Record<string, number> = {};

  funds.forEach((fund, fIdx) => {
    const fundWeight = w[fIdx];
    fund.holdings.forEach((h) => {
      totals[h.sector] = (totals[h.sector] || 0) + fundWeight * h.weight;
    });
  });

  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .map(([sector, val]) => ({
      sector,
      weight: Number(((val / sum) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Liquidity Stress Testing
 * Days to liquidate 25% and 50% under 10% daily volume participation limit
 */
export function calculateLiquidityStress(
  holdings: FundHolding[],
  aumCrores: number = 25000,
  participationRate: number = 0.10
): LiquidityStressResult {
  if (!holdings?.length) {
    return {
      days25Prorata: 0,
      days50Prorata: 0,
      days25Waterfall: 0,
      days50Waterfall: 0,
      pctLiquidUnder3Days: 100,
      pctLiquid3To7Days: 0,
      pctIlliquidOver10Days: 0,
      holdings: [],
    };
  }

  const analyzed = holdings.map((h) => {
    const positionCr = (h.weight / 100.0) * aumCrores;
    const dailyAbsorbable = h.adtv_cr * participationRate;
    const days = h.isin === 'CASH_EQUIV' ? 0.0 : positionCr / Math.max(dailyAbsorbable, 0.1);
    return {
      isin: h.isin,
      name: h.name,
      weight: h.weight,
      positionCr: Number(positionCr.toFixed(2)),
      adtvCr: h.adtv_cr,
      daysToLiquidate: Number(days.toFixed(1)),
    };
  });

  // Pro-rata: dictated by the maximum days scaled by percentage
  const nonCash = analyzed.filter((h) => h.isin !== 'CASH_EQUIV');
  const maxDays = Math.max(...nonCash.map((h) => h.daysToLiquidate), 1.0);
  const days25Prorata = Number((maxDays * 0.25).toFixed(1));
  const days50Prorata = Number((maxDays * 0.50).toFixed(1));

  // Waterfall: sort ascending days, accumulate to 25% and 50%
  const sorted = [...analyzed].sort((a, b) => a.daysToLiquidate - b.daysToLiquidate);
  let cumW = 0;
  let days25Waterfall = 0.5;
  let days50Waterfall = 1.5;

  for (const h of sorted) {
    cumW += h.weight;
    if (cumW >= 25 && days25Waterfall === 0.5) {
      days25Waterfall = h.daysToLiquidate;
    }
    if (cumW >= 50 && days50Waterfall === 1.5) {
      days50Waterfall = h.daysToLiquidate;
      break;
    }
  }

  // Brackets
  const under3 = analyzed.filter((h) => h.daysToLiquidate <= 3).reduce((a, b) => a + b.weight, 0);
  const threeToSeven = analyzed.filter((h) => h.daysToLiquidate > 3 && h.daysToLiquidate <= 7).reduce((a, b) => a + b.weight, 0);
  const over10 = analyzed.filter((h) => h.daysToLiquidate > 10).reduce((a, b) => a + b.weight, 0);

  return {
    days25Prorata,
    days50Prorata,
    days25Waterfall: Number(days25Waterfall.toFixed(1)),
    days50Waterfall: Number(days50Waterfall.toFixed(1)),
    pctLiquidUnder3Days: Number(under3.toFixed(1)),
    pctLiquid3To7Days: Number(threeToSeven.toFixed(1)),
    pctIlliquidOver10Days: Number(over10.toFixed(1)),
    holdings: analyzed.sort((a, b) => b.daysToLiquidate - a.daysToLiquidate),
  };
}

/**
 * Debt Duration Sensitivity
 * Delta_NAV% = -D_mod * Delta_y + 0.5 * Convexity * (Delta_y)^2
 */
export function calculateDurationSensitivity(
  macaulayDuration: number = 3.85,
  currentYtm: number = 0.0745,
  convexity: number = 24.5,
  shockBpsList: number[] = [-200, -100, -50, 0, 50, 100, 200],
  baseNav: number = 100.0
): DurationShockPoint[] {
  const modDuration = currentYtm > -1 ? macaulayDuration / (1.0 + currentYtm) : macaulayDuration;

  return shockBpsList.map((bps) => {
    const deltaY = bps / 10000.0;
    const durImpact = -modDuration * deltaY;
    const cvxImpact = 0.5 * convexity * Math.pow(deltaY, 2);
    const totalImpact = durImpact + cvxImpact;
    const simulatedNav = baseNav * (1.0 + totalImpact);

    return {
      shockBps: bps,
      durationImpactPct: Number((durImpact * 100).toFixed(2)),
      convexityBenefitPct: Number((cvxImpact * 100).toFixed(3)),
      totalNavChangePct: Number((totalImpact * 100).toFixed(2)),
      simulatedNav: Number(simulatedNav.toFixed(2)),
    };
  });
}
