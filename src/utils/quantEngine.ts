import {
  FundHolding,
  NavPoint,
  TrailingCagr,
  RollingDistribution,
  RiskMetrics,
  LiquidityStressResult,
  DurationShockPoint,
  SipSimulationResult,
  AssetClass,
} from '../types/quant';

/**
 * Annualized CAGR for specific periods: (P_end / P_start) ** (1 / years) - 1
 * Supports sub-annual periods (3M = 0.25Y, 6M = 0.5Y, 1Y, 3Y, 5Y, 7Y, 10Y)
 */
export function computeTrailingCagr(
  series: NavPoint[],
  periods: number[] = [0.25, 0.5, 1, 3, 5, 7, 10]
): TrailingCagr {
  const result: TrailingCagr = {};
  if (!series || series.length < 10) return result;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const endPoint = sorted[sorted.length - 1];
  const endDate = new Date(endPoint.date);
  const totalDaysAvailable = (endDate.getTime() - new Date(sorted[0].date).getTime()) / 86400000;

  for (const yrs of periods) {
    const label =
      yrs === 0.25 ? '3M' : yrs === 0.5 ? '6M' : `${yrs}Y`;

    const targetDays = yrs * 365.25;
    if (totalDaysAvailable < targetDays * 0.85) {
      // Fund does not have enough history for this period -> N/A
      result[label] = undefined;
      continue;
    }

    const targetDate = new Date(endDate.getTime() - targetDays * 86400000);
    const targetIso = targetDate.toISOString().split('T')[0];

    let startPoint: NavPoint | undefined;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].date <= targetIso) {
        startPoint = sorted[i];
        break;
      }
    }

    if (startPoint && startPoint.nav > 0 && endPoint.nav > 0) {
      if (yrs < 1.0) {
        // Absolute return for sub-annual periods (3M, 6M)
        const absReturn = (endPoint.nav - startPoint.nav) / startPoint.nav;
        result[label] = Number((absReturn * 100).toFixed(2));
      } else {
        // Annualized CAGR for >= 1 year
        const cagr = Math.pow(endPoint.nav / startPoint.nav, 1.0 / yrs) - 1.0;
        result[label] = Number((cagr * 100).toFixed(2));
      }
    } else {
      result[label] = undefined;
    }
  }

  return result;
}

/**
 * Full Rolling Returns Distribution (1Y, 3Y, 5Y, etc.)
 */
export function computeRollingReturns(
  series: NavPoint[],
  windowYears: number = 3.0,
  tradingDaysPerYear: number = 252
): RollingDistribution {
  const windowDays = Math.floor(windowYears * tradingDaysPerYear);
  const empty: RollingDistribution = {
    windowYears,
    mean: 0,
    median: 0,
    min: 0,
    max: 0,
    q25: 0,
    q75: 0,
    std: 0,
    count: 0,
    pctPositive: 0,
    pctNegative: 0,
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

  const sortedValues = [...rollValues].sort((a, b) => a - b);
  const n = sortedValues.length;
  const sum = sortedValues.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2 : sortedValues[Math.floor(n / 2)];
  const min = sortedValues[0];
  const max = sortedValues[n - 1];
  const q25 = sortedValues[Math.floor(n * 0.25)];
  const q75 = sortedValues[Math.floor(n * 0.75)];

  const variance = sortedValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  const positiveCount = sortedValues.filter((v) => v > 0).length;
  const negativeCount = n - positiveCount;

  return {
    windowYears,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    q25: Number(q25.toFixed(2)),
    q75: Number(q75.toFixed(2)),
    std: Number(std.toFixed(2)),
    count: n,
    pctPositive: Number(((positiveCount / n) * 100).toFixed(1)),
    pctNegative: Number(((negativeCount / n) * 100).toFixed(1)),
    series: rollSeries,
  };
}

/**
 * Benchmark Hit Rate: Percentage of rolling windows where Fund Return > Benchmark Return
 */
export function computeBenchmarkHitRate(
  fundRolling: { date: string; value: number }[],
  benchRolling: { date: string; value: number }[]
): number | undefined {
  if (!fundRolling.length || !benchRolling.length) return undefined;

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

  if (matched === 0) return undefined;
  return Number(((beatCount / matched) * 100).toFixed(1));
}

/**
 * Comprehensive Risk & Active Alpha Metrics
 */
export function computeComprehensiveMetrics(
  fundSeries: NavPoint[],
  benchSeries: NavPoint[],
  fundName: string,
  schemeCode: number,
  category: string,
  assetClass: AssetClass,
  rfAnnual: number = 0.065
): RiskMetrics {
  const empty: RiskMetrics = {
    fundName,
    schemeCode,
    category,
    assetClass,
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
    calmarRatio: 0,
    upsideCapture: 100,
    downsideCapture: 100,
    peakDate: '',
    maxDdDate: '',
    recoveryDate: '',
  };

  if (!fundSeries.length || !benchSeries.length) return empty;

  const benchMap = new Map(benchSeries.map((p) => [p.date, p.nav]));
  const aligned: { date: string; fNav: number; bNav: number }[] = [];

  for (const f of fundSeries) {
    const bNav = benchMap.get(f.date);
    if (bNav !== undefined) {
      aligned.push({ date: f.date, fNav: f.nav, bNav });
    }
  }

  if (aligned.length < 20) return empty;

  const fReturns: number[] = [];
  const bReturns: number[] = [];
  for (let i = 1; i < aligned.length; i++) {
    fReturns.push((aligned[i].fNav - aligned[i - 1].fNav) / aligned[i - 1].fNav);
    bReturns.push((aligned[i].bNav - aligned[i - 1].bNav) / aligned[i - 1].bNav);
  }

  const n = fReturns.length;
  const fCum = aligned[aligned.length - 1].fNav / aligned[0].fNav;
  const bCum = aligned[aligned.length - 1].bNav / aligned[0].bNav;

  const fAnnReturn = Math.pow(fCum, 252 / n) - 1.0;
  const bAnnReturn = Math.pow(bCum, 252 / n) - 1.0;

  const fMean = fReturns.reduce((a, b) => a + b, 0) / n;
  const bMean = bReturns.reduce((a, b) => a + b, 0) / n;

  const fVariance = fReturns.reduce((acc, r) => acc + Math.pow(r - fMean, 2), 0) / (n - 1);
  const bVariance = bReturns.reduce((acc, r) => acc + Math.pow(r - bMean, 2), 0) / (n - 1);
  const fAnnVol = Math.sqrt(fVariance) * Math.sqrt(252);

  const sharpe = fAnnVol > 1e-6 ? (fAnnReturn - rfAnnual) / fAnnVol : 0;

  const rfDaily = Math.pow(1 + rfAnnual, 1 / 252) - 1;
  const downsideVariance =
    fReturns.reduce((acc, r) => {
      const diff = Math.min(0, r - rfDaily);
      return acc + diff * diff;
    }, 0) / n;
  const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortino = downsideDev > 1e-6 ? (fAnnReturn - rfAnnual) / downsideDev : 0;

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

  for (let i = 0; i < aligned.length; i++) {
    const nav = aligned[i].fNav;
    if (nav > runningMax) {
      runningMax = nav;
    }
    const dd = (nav - runningMax) / runningMax;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdIdx = i;
    }
  }

  let prePeakVal = -Infinity;
  for (let i = 0; i <= maxDdIdx; i++) {
    if (aligned[i].fNav >= prePeakVal) {
      prePeakVal = aligned[i].fNav;
      peakIdx = i;
    }
  }

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

  const calmarRatio = Math.abs(maxDd) > 1e-4 ? fAnnReturn / Math.abs(maxDd) : 0;

  // Upside / Downside Capture
  let upFundSum = 0, upBenchSum = 0;
  let downFundSum = 0, downBenchSum = 0;
  for (let i = 0; i < n; i++) {
    if (bReturns[i] > 0) {
      upFundSum += fReturns[i];
      upBenchSum += bReturns[i];
    } else if (bReturns[i] < 0) {
      downFundSum += fReturns[i];
      downBenchSum += bReturns[i];
    }
  }
  const upsideCapture = upBenchSum !== 0 ? (upFundSum / upBenchSum) * 100 : 100;
  const downsideCapture = downBenchSum !== 0 ? (downFundSum / downBenchSum) * 100 : 100;

  return {
    fundName,
    schemeCode,
    category,
    assetClass,
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
    calmarRatio: Number(calmarRatio.toFixed(2)),
    upsideCapture: Number(upsideCapture.toFixed(1)),
    downsideCapture: Number(downsideCapture.toFixed(1)),
    peakDate,
    maxDdDate,
    recoveryDate,
  };
}

/**
 * Monthly Systematic Investment Plan (SIP) Wealth Simulator with XIRR
 */
export function simulateMonthlySip(
  series: NavPoint[],
  monthlyAmount: number = 10000,
  years: number = 5
): SipSimulationResult {
  if (!series || series.length < 30) {
    return {
      monthlyAmount,
      totalInvested: 0,
      totalCorpus: 0,
      absoluteProfit: 0,
      xirrPct: 0,
      timeline: [],
    };
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const endDate = new Date(sorted[sorted.length - 1].date);
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - years);
  const startIso = startDate.toISOString().split('T')[0];

  const subSeries = sorted.filter((p) => p.date >= startIso);
  if (subSeries.length < 10) {
    return {
      monthlyAmount,
      totalInvested: 0,
      totalCorpus: 0,
      absoluteProfit: 0,
      xirrPct: 0,
      timeline: [],
    };
  }

  let totalUnits = 0;
  let totalInvested = 0;
  const timeline: { date: string; invested: number; corpus: number }[] = [];
  const cashFlows: { amount: number; date: Date }[] = [];

  let lastMonth = '';
  for (const point of subSeries) {
    const ym = point.date.slice(0, 7);
    if (ym !== lastMonth) {
      lastMonth = ym;
      const unitsBought = monthlyAmount / point.nav;
      totalUnits += unitsBought;
      totalInvested += monthlyAmount;

      cashFlows.push({
        amount: -monthlyAmount,
        date: new Date(point.date),
      });

      timeline.push({
        date: point.date,
        invested: totalInvested,
        corpus: Math.round(totalUnits * point.nav),
      });
    }
  }

  const finalNav = subSeries[subSeries.length - 1].nav;
  const totalCorpus = Math.round(totalUnits * finalNav);
  const absoluteProfit = totalCorpus - totalInvested;

  cashFlows.push({
    amount: totalCorpus,
    date: new Date(subSeries[subSeries.length - 1].date),
  });

  let xirr = 0.12;
  const firstDate = cashFlows[0]?.date.getTime() || 0;
  for (let iter = 0; iter < 25; iter++) {
    let npv = 0;
    let dNpv = 0;
    for (const cf of cashFlows) {
      const dt = (cf.date.getTime() - firstDate) / (365.25 * 86400000);
      const factor = Math.pow(1 + xirr, dt);
      if (factor > 0) {
        npv += cf.amount / factor;
        dNpv -= (dt * cf.amount) / (factor * (1 + xirr));
      }
    }
    if (Math.abs(npv) < 1.0 || Math.abs(dNpv) < 1e-6) break;
    xirr = xirr - npv / dNpv;
    if (xirr < -0.99) xirr = -0.9;
  }

  return {
    monthlyAmount,
    totalInvested,
    totalCorpus,
    absoluteProfit,
    xirrPct: Number((xirr * 100).toFixed(2)),
    timeline,
  };
}

/**
 * Pairwise Daily Return Correlation Matrix & Diversification Score
 */
export function computeReturnCorrelationMatrix(
  seriesMap: Record<number, NavPoint[]>,
  fundNames: Record<number, string>
): { codes: number[]; names: string[]; matrix: number[][]; diversificationScore: number } {
  const codes = Object.keys(seriesMap).map((k) => parseInt(k, 10));
  if (codes.length < 2) {
    return { codes, names: codes.map((c) => fundNames[c] || `Scheme ${c}`), matrix: [[1.0]], diversificationScore: 0 };
  }

  const dateSets = codes.map((c) => new Set(seriesMap[c].map((p) => p.date)));
  const commonDates: string[] = [];
  const firstSet = dateSets[0];
  firstSet.forEach((d) => {
    if (dateSets.every((s) => s.has(d))) {
      commonDates.push(d);
    }
  });

  commonDates.sort();
  if (commonDates.length < 20) {
    const names = codes.map((c) => fundNames[c] || `Scheme ${c}`);
    const eye = codes.map((_, i) => codes.map((_, j) => (i === j ? 1.0 : 0.8)));
    return { codes, names, matrix: eye, diversificationScore: 20 };
  }

  const returnsByCode: Record<number, number[]> = {};
  codes.forEach((c) => {
    const map = new Map(seriesMap[c].map((p) => [p.date, p.nav]));
    const rets: number[] = [];
    for (let i = 1; i < commonDates.length; i++) {
      const p1 = map.get(commonDates[i - 1])!;
      const p2 = map.get(commonDates[i])!;
      rets.push((p2 - p1) / p1);
    }
    returnsByCode[c] = rets;
  });

  const n = codes.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1.0));
  let offDiagSum = 0;
  let offDiagCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (i < j) {
        const r1 = returnsByCode[codes[i]];
        const r2 = returnsByCode[codes[j]];
        const m1 = r1.reduce((a, b) => a + b, 0) / r1.length;
        const m2 = r2.reduce((a, b) => a + b, 0) / r2.length;
        let cov = 0, v1 = 0, v2 = 0;
        for (let k = 0; k < r1.length; k++) {
          const d1 = r1[k] - m1;
          const d2 = r2[k] - m2;
          cov += d1 * d2;
          v1 += d1 * d1;
          v2 += d2 * d2;
        }
        const denom = Math.sqrt(v1 * v2);
        const corr = denom > 1e-8 ? cov / denom : 0;
        matrix[i][j] = Number(corr.toFixed(2));
        matrix[j][i] = Number(corr.toFixed(2));
        offDiagSum += corr;
        offDiagCount++;
      }
    }
  }

  const avgCorr = offDiagCount > 0 ? offDiagSum / offDiagCount : 1.0;
  const diversificationScore = Math.max(0, Math.min(100, Math.round((1.0 - avgCorr) * 100)));

  return {
    codes,
    names: codes.map((c) => fundNames[c] || `Scheme ${c}`),
    matrix,
    diversificationScore,
  };
}

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
    weight: Number(((val / sum) * 100).toFixed(1)),
  }));
}

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
      weight: Number(((val / sum) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.weight - a.weight);
}

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

  const nonCash = analyzed.filter((h) => h.isin !== 'CASH_EQUIV');
  const maxDays = Math.max(...nonCash.map((h) => h.daysToLiquidate), 1.0);
  const days25Prorata = Number((maxDays * 0.25).toFixed(1));
  const days50Prorata = Number((maxDays * 0.50).toFixed(1));

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
