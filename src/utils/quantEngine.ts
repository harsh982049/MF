import {
  AssetClass,
  CorporateActionBreak,
  DurationSensitivityResult,
  FundHolding,
  LiquidityStressResult,
  NavPoint,
  RiskMetrics,
  RollingDistribution,
  SipSimulationResult,
  TrailingCagr,
  TrailingCagrResult,
} from '../types/quant';
import {
  detectCorporateActionBreaks,
  doesWindowSpanCorporateActionBreak,
} from './navValidator';

/**
 * Checks whether a portfolio holding is cash, TREPS collateral, or sovereign liquidity buffer.
 * Used to universally exclude cash from stock overlap calculations across all mutual funds.
 */
export function isCashEquivalentHolding(h: FundHolding): boolean {
  if (!h) return false;
  const isin = (h.isin || '').trim().toUpperCase();
  const name = (h.name || '').toLowerCase();
  const mcap = (h.mcap || '').toLowerCase();
  return (
    isin === 'CASH_EQUIV' ||
    isin.startsWith('CASH') ||
    isin === 'TREPS' ||
    isin.startsWith('TREPS') ||
    name.includes('treps') ||
    name.includes('cash collateral') ||
    name.includes('short-term collateral') ||
    name.includes('cash & cash equivalent') ||
    mcap.includes('cash')
  );
}

function cleanValidSeries(series: NavPoint[] | null | undefined): NavPoint[] {
  if (!series || !Array.isArray(series) || series.length === 0) return [];
  return [...series]
    .filter((p) => p && typeof p.date === 'string' && Number.isFinite(p.nav) && p.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Trailing returns / CAGR with corporate-action quarantine and explicit unavailable reasons.
 */
export function computeTrailingCagrWithMeta(
  series: NavPoint[],
  periods: number[] = [0.25, 0.5, 1, 3, 5, 7, 10],
  corporateActionBreaks?: CorporateActionBreak[]
): TrailingCagrResult {
  const values: TrailingCagr = {};
  const unavailableReasons: Record<string, string> = {};

  const sorted = cleanValidSeries(series);
  const breaks = corporateActionBreaks ?? detectCorporateActionBreaks(sorted);

  if (sorted.length < 2) {
    for (const yrs of periods) {
      const label = yrs === 0.25 ? '3M' : yrs === 0.5 ? '6M' : `${yrs}Y`;
      values[label] = null;
      unavailableReasons[label] = 'NAV series unavailable or fewer than 2 valid observations.';
    }
    return { values, unavailableReasons };
  }

  const endPoint = sorted[sorted.length - 1];
  const endDate = new Date(`${endPoint.date}T00:00:00Z`);
  const firstDate = new Date(`${sorted[0].date}T00:00:00Z`);
  const totalDaysAvailable = (endDate.getTime() - firstDate.getTime()) / 86400000;

  for (const yrs of periods) {
    const label = yrs === 0.25 ? '3M' : yrs === 0.5 ? '6M' : `${yrs}Y`;
    const targetDays = yrs * 365.25;

    if (totalDaysAvailable < targetDays * 0.85) {
      values[label] = null;
      unavailableReasons[label] = `Insufficient history (${Math.round(totalDaysAvailable)}d available vs ${Math.round(targetDays)}d required).`;
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

    if (!startPoint || startPoint.nav <= 0 || endPoint.nav <= 0) {
      values[label] = null;
      unavailableReasons[label] = `No valid start observation at or before ${targetIso}.`;
      continue;
    }

    const spannedBreak = doesWindowSpanCorporateActionBreak(startPoint.date, endPoint.date, breaks);
    if (spannedBreak) {
      values[label] = null;
      unavailableReasons[label] = spannedBreak.explanation;
      continue;
    }

    if (yrs < 1.0) {
      const absReturn = (endPoint.nav - startPoint.nav) / startPoint.nav;
      values[label] = Number((absReturn * 100).toFixed(2));
    } else {
      const cagr = Math.pow(endPoint.nav / startPoint.nav, 1.0 / yrs) - 1.0;
      values[label] = Number((cagr * 100).toFixed(2));
    }
  }

  return { values, unavailableReasons };
}

export function computeTrailingCagr(
  series: NavPoint[],
  periods: number[] = [0.25, 0.5, 1, 3, 5, 7, 10],
  corporateActionBreaks?: CorporateActionBreak[]
): TrailingCagr {
  return computeTrailingCagrWithMeta(series, periods, corporateActionBreaks).values;
}

/**
 * Full Rolling Returns Distribution (1Y, 3Y, 5Y, 7Y, etc.)
 * Quarantines any rolling window spanning an unresolved corporate-action break
 * and returns null metrics (available: false) when zero clean windows remain.
 */
export function computeRollingReturns(
  series: NavPoint[],
  windowYears: number = 3.0,
  tradingDaysPerYear: number = 252,
  corporateActionBreaks?: CorporateActionBreak[]
): RollingDistribution {
  const windowDays = Math.floor(windowYears * tradingDaysPerYear);
  const emptyUnavailable = (reason: string, quarantinedWindowsCount: number = 0): RollingDistribution => ({
    windowYears,
    available: false,
    unavailableReason: reason,
    mean: null,
    median: null,
    min: null,
    max: null,
    q25: null,
    q75: null,
    std: null,
    count: 0,
    quarantinedWindowsCount,
    pctPositive: null,
    pctNegative: null,
    series: [],
  });

  const sorted = cleanValidSeries(series);
  if (sorted.length <= windowDays) {
    return emptyUnavailable(
      sorted.length === 0
        ? 'NAV series unavailable.'
        : `Insufficient history (${sorted.length} sessions vs >${windowDays} required for ${windowYears}Y rolling).`
    );
  }

  const breaks = corporateActionBreaks ?? detectCorporateActionBreaks(sorted);
  const rollValues: number[] = [];
  const rollSeries: { date: string; value: number }[] = [];
  let quarantinedWindowsCount = 0;

  for (let i = windowDays; i < sorted.length; i++) {
    const startPt = sorted[i - windowDays];
    const endPt = sorted[i];

    if (doesWindowSpanCorporateActionBreak(startPt.date, endPt.date, breaks)) {
      quarantinedWindowsCount++;
      continue;
    }

    if (startPt.nav > 0 && endPt.nav > 0) {
      const cagr = (Math.pow(endPt.nav / startPt.nav, tradingDaysPerYear / windowDays) - 1.0) * 100.0;
      if (Number.isFinite(cagr)) {
        rollValues.push(cagr);
        rollSeries.push({ date: endPt.date, value: Number(cagr.toFixed(2)) });
      }
    }
  }

  if (rollValues.length === 0) {
    const reason =
      quarantinedWindowsCount > 0
        ? `All ${quarantinedWindowsCount} ${windowYears}Y rolling windows span an unresolved corporate-action break.`
        : `No valid ${windowYears}Y rolling windows computed.`;
    return emptyUnavailable(reason, quarantinedWindowsCount);
  }

  const sortedValues = [...rollValues].sort((a, b) => a - b);
  const n = sortedValues.length;
  const sum = sortedValues.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median =
    n % 2 === 0
      ? (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2
      : sortedValues[Math.floor(n / 2)];
  const min = sortedValues[0];
  const max = sortedValues[n - 1];
  const q25 = sortedValues[Math.floor(n * 0.25)];
  const q75 = sortedValues[Math.floor(n * 0.75)];

  const variance = sortedValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  const positiveCount = sortedValues.filter((v) => v > 0).length;
  const negativeCount = sortedValues.filter((v) => v < 0).length;

  return {
    windowYears,
    available: true,
    unavailableReason: null,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    q25: Number(q25.toFixed(2)),
    q75: Number(q75.toFixed(2)),
    std: Number(std.toFixed(2)),
    count: n,
    quarantinedWindowsCount,
    pctPositive: Number(((positiveCount / n) * 100).toFixed(1)),
    pctNegative: Number(((negativeCount / n) * 100).toFixed(1)),
    series: rollSeries,
  };
}

/**
 * Benchmark Hit Rate: Percentage of rolling windows where Fund Return > Benchmark Return
 * Returns null when fund or benchmark rolling windows are unavailable or have zero common dates.
 */
export function computeBenchmarkHitRate(
  fundRolling: { date: string; value: number }[],
  benchRolling: { date: string; value: number }[]
): number | null {
  if (!fundRolling?.length || !benchRolling?.length) return null;

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

  if (matched === 0) return null;
  return Number(((beatCount / matched) * 100).toFixed(1));
}

/**
 * Synchronizes fund and benchmark time series via a strict inner date join.
 */
export function alignFundAndBenchmarkSeries(
  fundSeries: NavPoint[],
  benchSeries: NavPoint[]
): { date: string; fNav: number; bNav: number }[] {
  const cleanFund = cleanValidSeries(fundSeries);
  const cleanBench = cleanValidSeries(benchSeries);
  if (!cleanFund.length || !cleanBench.length) return [];

  const benchMap = new Map(cleanBench.map((p) => [p.date, p.nav]));
  const aligned: { date: string; fNav: number; bNav: number }[] = [];

  for (const f of cleanFund) {
    const bNav = benchMap.get(f.date);
    if (bNav !== undefined && bNav > 0 && f.nav > 0) {
      aligned.push({ date: f.date, fNav: f.nav, bNav });
    }
  }

  return aligned;
}

/**
 * Comprehensive Risk & Active Alpha Metrics
 * Decouples fund-only risk metrics from benchmark-relative metrics so a missing benchmark
 * NEVER zeroes out validated fund-only metrics, and unsupported values always emit null.
 */
export function computeComprehensiveMetrics(
  fundSeries: NavPoint[],
  benchSeries: NavPoint[],
  fundName: string,
  schemeCode: number,
  category: string,
  assetClass: AssetClass,
  rfAnnual: number = 0.065,
  corporateActionBreaks?: CorporateActionBreak[]
): RiskMetrics {
  const unavailableReasons: Record<string, string> = {};
  const cleanFund = cleanValidSeries(fundSeries);
  const cleanBench = cleanValidSeries(benchSeries);
  const breaks = corporateActionBreaks ?? detectCorporateActionBreaks(cleanFund);

  const buildUnavailableAll = (reasonKey: string, reason: string): RiskMetrics => ({
    fundName,
    schemeCode,
    category,
    assetClass,
    fundOnlyAvailable: false,
    benchmarkRelativeAvailable: false,
    rfAnnualApplied: rfAnnual,
    observationCount: cleanFund.length,
    startDate: cleanFund[0]?.date ?? null,
    endDate: cleanFund[cleanFund.length - 1]?.date ?? null,
    unavailableReasons: { [reasonKey]: reason },
    cagr: null,
    volatility: null,
    sharpe: null,
    sortino: null,
    beta: null,
    jensensAlpha: null,
    rSquared: null,
    trackingError: null,
    informationRatio: null,
    maxDrawdown: null,
    recoveryDays: null,
    calmarRatio: null,
    upsideCapture: null,
    downsideCapture: null,
    peakDate: null,
    maxDdDate: null,
    recoveryDate: null,
  });

  if (cleanFund.length < 20) {
    return buildUnavailableAll(
      'fundOnly',
      cleanFund.length === 0
        ? 'Validated NAV series unavailable.'
        : `Insufficient fund NAV observations (${cleanFund.length} < 20 required).`
    );
  }

  const spannedBreak = doesWindowSpanCorporateActionBreak(
    cleanFund[0].date,
    cleanFund[cleanFund.length - 1].date,
    breaks
  );
  if (spannedBreak) {
    return buildUnavailableAll('corporateAction', spannedBreak.explanation);
  }

  // Step 1: Independent Fund-Only Risk & Return Calculations
  const fOnlyReturns: number[] = [];
  for (let i = 1; i < cleanFund.length; i++) {
    fOnlyReturns.push((cleanFund[i].nav - cleanFund[i - 1].nav) / cleanFund[i - 1].nav);
  }

  const nFund = fOnlyReturns.length;
  const fCumOnly = cleanFund[cleanFund.length - 1].nav / cleanFund[0].nav;
  const fAnnReturn = Math.pow(fCumOnly, 252 / nFund) - 1.0;

  const fMeanOnly = fOnlyReturns.reduce((a, b) => a + b, 0) / nFund;
  const fVarOnly =
    nFund > 1
      ? fOnlyReturns.reduce((acc, r) => acc + Math.pow(r - fMeanOnly, 2), 0) / (nFund - 1)
      : 0;
  const fAnnVol = Math.sqrt(Math.max(0, fVarOnly)) * Math.sqrt(252);

  let sharpe: number | null = null;
  if (fAnnVol > 1e-8) {
    sharpe = Number(((fAnnReturn - rfAnnual) / fAnnVol).toFixed(2));
  } else {
    unavailableReasons.sharpe = 'Fund volatility is zero (flat return series).';
  }

  const rfDaily = Math.pow(1 + rfAnnual, 1 / 252) - 1;
  const downsideVarOnly =
    fOnlyReturns.reduce((acc, r) => {
      const diff = Math.min(0, r - rfDaily);
      return acc + diff * diff;
    }, 0) / nFund;
  const downsideDev = Math.sqrt(Math.max(0, downsideVarOnly)) * Math.sqrt(252);

  let sortino: number | null = null;
  if (fAnnVol > 1e-8 && downsideDev > 1e-8) {
    sortino = Number(((fAnnReturn - rfAnnual) / downsideDev).toFixed(2));
  } else {
    unavailableReasons.sortino =
      fAnnVol <= 1e-8 ? 'Fund volatility is zero (flat return series).' : 'Downside deviation is zero.';
  }

  // Max Drawdown & Recovery on validated fund series
  let runningMax = -Infinity;
  let maxDd = 0;
  let maxDdIdx = 0;
  let peakIdx = 0;

  for (let i = 0; i < cleanFund.length; i++) {
    const nav = cleanFund[i].nav;
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
    if (cleanFund[i].nav >= prePeakVal) {
      prePeakVal = cleanFund[i].nav;
      peakIdx = i;
    }
  }

  let recoveryIdx = -1;
  for (let i = maxDdIdx; i < cleanFund.length; i++) {
    if (cleanFund[i].nav >= prePeakVal) {
      recoveryIdx = i;
      break;
    }
  }

  const peakDate = cleanFund[peakIdx].date;
  const maxDdDate = cleanFund[maxDdIdx].date;
  let recoveryDate = 'Ongoing';
  let recoveryDays = Math.round(
    (new Date(`${cleanFund[cleanFund.length - 1].date}T00:00:00Z`).getTime() -
      new Date(`${peakDate}T00:00:00Z`).getTime()) /
      86400000
  );

  if (recoveryIdx !== -1) {
    recoveryDate = cleanFund[recoveryIdx].date;
    recoveryDays = Math.round(
      (new Date(`${recoveryDate}T00:00:00Z`).getTime() -
        new Date(`${peakDate}T00:00:00Z`).getTime()) /
        86400000
    );
  }

  let calmarRatio: number | null = null;
  if (Math.abs(maxDd) > 1e-6) {
    calmarRatio = Number((fAnnReturn / Math.abs(maxDd)).toFixed(2));
  } else {
    unavailableReasons.calmarRatio = 'Maximum drawdown is zero.';
  }

  // Step 2: Benchmark-Relative Metrics (Inner Join)
  let benchmarkRelativeAvailable = false;
  let beta: number | null = null;
  let jensensAlpha: number | null = null;
  let rSquared: number | null = null;
  let trackingError: number | null = null;
  let informationRatio: number | null = null;
  let upsideCapture: number | null = null;
  let downsideCapture: number | null = null;

  const aligned = alignFundAndBenchmarkSeries(cleanFund, cleanBench);
  if (aligned.length < 20) {
    unavailableReasons.benchmark =
      cleanBench.length === 0
        ? 'Independent verified benchmark series is unavailable (Batch 2).'
        : `Insufficient overlapping sessions with benchmark (${aligned.length} < 20 required).`;
  } else {
    const fAlignedRet: number[] = [];
    const bAlignedRet: number[] = [];
    for (let i = 1; i < aligned.length; i++) {
      fAlignedRet.push((aligned[i].fNav - aligned[i - 1].fNav) / aligned[i - 1].fNav);
      bAlignedRet.push((aligned[i].bNav - aligned[i - 1].bNav) / aligned[i - 1].bNav);
    }

    const nAligned = fAlignedRet.length;
    const fCumAligned = aligned[aligned.length - 1].fNav / aligned[0].fNav;
    const bCumAligned = aligned[aligned.length - 1].bNav / aligned[0].bNav;
    const fAnnAligned = Math.pow(fCumAligned, 252 / nAligned) - 1.0;
    const bAnnAligned = Math.pow(bCumAligned, 252 / nAligned) - 1.0;

    const fMeanA = fAlignedRet.reduce((a, b) => a + b, 0) / nAligned;
    const bMeanA = bAlignedRet.reduce((a, b) => a + b, 0) / nAligned;

    const fVarA =
      nAligned > 1
        ? fAlignedRet.reduce((acc, r) => acc + Math.pow(r - fMeanA, 2), 0) / (nAligned - 1)
        : 0;
    const bVarA =
      nAligned > 1
        ? bAlignedRet.reduce((acc, r) => acc + Math.pow(r - bMeanA, 2), 0) / (nAligned - 1)
        : 0;

    let cov = 0;
    for (let i = 0; i < nAligned; i++) {
      cov += (fAlignedRet[i] - fMeanA) * (bAlignedRet[i] - bMeanA);
    }
    cov = nAligned > 1 ? cov / (nAligned - 1) : 0;

    benchmarkRelativeAvailable = true;

    if (bVarA > 1e-10) {
      const rawBeta = cov / bVarA;
      beta = Number(rawBeta.toFixed(2));
      const expectedReturn = rfAnnual + rawBeta * (bAnnAligned - rfAnnual);
      jensensAlpha = Number(((fAnnAligned - expectedReturn) * 100).toFixed(2));

      if (fVarA > 1e-10) {
        const corr = cov / Math.sqrt(fVarA * bVarA);
        rSquared = Number(Math.min(1.0, Math.pow(corr, 2)).toFixed(3));
      } else {
        rSquared = null;
        unavailableReasons.rSquared = 'Fund variance is zero.';
      }
    } else {
      unavailableReasons.beta = 'Benchmark variance is zero.';
      unavailableReasons.jensensAlpha = 'Benchmark variance is zero.';
      unavailableReasons.rSquared = 'Benchmark variance is zero.';
    }

    const excessReturns = fAlignedRet.map((r, i) => r - bAlignedRet[i]);
    const excessMean = excessReturns.reduce((a, b) => a + b, 0) / nAligned;
    const excessVar =
      nAligned > 1
        ? excessReturns.reduce((acc, er) => acc + Math.pow(er - excessMean, 2), 0) / (nAligned - 1)
        : 0;
    const rawTe = Math.sqrt(Math.max(0, excessVar)) * Math.sqrt(252);
    trackingError = Number((rawTe * 100).toFixed(2));

    if (rawTe > 1e-8) {
      informationRatio = Number(((fAnnAligned - bAnnAligned) / rawTe).toFixed(2));
    } else {
      unavailableReasons.informationRatio = 'Tracking error is zero.';
    }

    let upFundSum = 0;
    let upBenchSum = 0;
    let upCount = 0;
    let downFundSum = 0;
    let downBenchSum = 0;
    let downCount = 0;

    for (let i = 0; i < nAligned; i++) {
      if (bAlignedRet[i] > 0) {
        upFundSum += fAlignedRet[i];
        upBenchSum += bAlignedRet[i];
        upCount++;
      } else if (bAlignedRet[i] < 0) {
        downFundSum += fAlignedRet[i];
        downBenchSum += bAlignedRet[i];
        downCount++;
      }
    }

    if (upCount > 0 && Math.abs(upBenchSum) > 1e-8) {
      upsideCapture = Number(((upFundSum / upBenchSum) * 100).toFixed(1));
    } else {
      unavailableReasons.upsideCapture = 'No positive benchmark sessions in window.';
    }

    if (downCount > 0 && Math.abs(downBenchSum) > 1e-8) {
      downsideCapture = Number(((downFundSum / downBenchSum) * 100).toFixed(1));
    } else {
      unavailableReasons.downsideCapture = 'No negative benchmark sessions in window.';
    }
  }

  return {
    fundName,
    schemeCode,
    category,
    assetClass,
    fundOnlyAvailable: true,
    benchmarkRelativeAvailable,
    rfAnnualApplied: rfAnnual,
    observationCount: cleanFund.length,
    startDate: cleanFund[0].date,
    endDate: cleanFund[cleanFund.length - 1].date,
    unavailableReasons,
    cagr: Number((fAnnReturn * 100).toFixed(2)),
    volatility: Number((fAnnVol * 100).toFixed(2)),
    sharpe,
    sortino,
    beta,
    jensensAlpha,
    rSquared,
    trackingError,
    informationRatio,
    maxDrawdown: Number((maxDd * 100).toFixed(2)),
    recoveryDays,
    calmarRatio,
    upsideCapture,
    downsideCapture,
    peakDate,
    maxDdDate,
    recoveryDate,
  };
}

/**
 * Monthly Systematic Investment Plan (SIP) Wealth Simulator with XIRR
 * Never substitutes a benchmark series and returns available: false when missing or break-spanned.
 */
export function simulateMonthlySip(
  series: NavPoint[],
  monthlyAmount: number = 10000,
  years: number = 5,
  corporateActionBreaks?: CorporateActionBreak[]
): SipSimulationResult {
  const unavailable = (reason: string): SipSimulationResult => ({
    available: false,
    reason,
    monthlyAmount,
    totalInvested: null,
    totalCorpus: null,
    absoluteProfit: null,
    xirrPct: null,
    timeline: [],
  });

  const sorted = cleanValidSeries(series);
  if (sorted.length < 30) {
    return unavailable(
      sorted.length === 0
        ? 'Validated scheme NAV series is unavailable.'
        : `Insufficient NAV history (${sorted.length} < 30 sessions).`
    );
  }

  const endDate = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
  const startDate = new Date(endDate);
  const wholeMonths = Math.round(years * 12);
  startDate.setUTCMonth(startDate.getUTCMonth() - wholeMonths);
  const startIso = startDate.toISOString().split('T')[0];

  const subSeries = sorted.filter((p) => p.date >= startIso);
  if (subSeries.length < 10) {
    return unavailable('Insufficient observations in selected SIP horizon.');
  }

  const breaks = corporateActionBreaks ?? detectCorporateActionBreaks(sorted);
  const spannedBreak = doesWindowSpanCorporateActionBreak(
    subSeries[0].date,
    subSeries[subSeries.length - 1].date,
    breaks
  );
  if (spannedBreak) {
    return unavailable(spannedBreak.explanation);
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
        date: new Date(`${point.date}T00:00:00Z`),
      });

      timeline.push({
        date: point.date,
        invested: totalInvested,
        corpus: Math.round(totalUnits * point.nav),
      });
    }
  }

  if (cashFlows.length === 0 || totalInvested <= 0) {
    return unavailable('No valid SIP instalment dates in selected window.');
  }

  const finalNav = subSeries[subSeries.length - 1].nav;
  const totalCorpus = Math.round(totalUnits * finalNav);
  const absoluteProfit = totalCorpus - totalInvested;

  cashFlows.push({
    amount: totalCorpus,
    date: new Date(`${subSeries[subSeries.length - 1].date}T00:00:00Z`),
  });

  let xirr = 0.12;
  const firstDate = cashFlows[0].date.getTime();
  let converged = false;
  for (let iter = 0; iter < 40; iter++) {
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
    if (Math.abs(npv) < 1.0) {
      converged = true;
      break;
    }
    if (Math.abs(dNpv) < 1e-8) break;
    xirr = xirr - npv / dNpv;
    if (xirr <= -0.99) xirr = -0.9;
    if (!Number.isFinite(xirr)) break;
  }

  return {
    available: true,
    reason: null,
    monthlyAmount,
    totalInvested,
    totalCorpus,
    absoluteProfit,
    xirrPct: converged && Number.isFinite(xirr) ? Number((xirr * 100).toFixed(2)) : null,
    timeline,
  };
}

export interface CorrelationMatrixResult {
  available: boolean;
  reason: string | null;
  codes: number[];
  names: string[];
  matrix: (number | null)[][] | null;
  diversificationScore: number | null;
}

/**
 * Pairwise Daily Return Correlation Matrix & Diversification Score
 * NEVER fabricates 0.8 correlation / score 20 when data is empty or insufficient.
 */
export function computeReturnCorrelationMatrix(
  seriesMap: Record<number, NavPoint[]>,
  fundNames: Record<number, string>
): CorrelationMatrixResult {
  const validCodes = Object.keys(seriesMap)
    .map((k) => parseInt(k, 10))
    .filter((c) => {
      const s = cleanValidSeries(seriesMap[c]);
      if (s.length < 20) return false;
      const breaks = detectCorporateActionBreaks(s);
      return !doesWindowSpanCorporateActionBreak(s[0].date, s[s.length - 1].date, breaks);
    });

  const names = validCodes.map((c) => fundNames[c] || `Scheme ${c}`);

  if (validCodes.length < 2) {
    return {
      available: false,
      reason: 'Unavailable: At least 2 validated non-quarantined schemes with >=20 sessions are required for correlation.',
      codes: validCodes,
      names,
      matrix: null,
      diversificationScore: null,
    };
  }

  const cleanedByCode: Record<number, NavPoint[]> = {};
  validCodes.forEach((c) => {
    cleanedByCode[c] = cleanValidSeries(seriesMap[c]);
  });

  const dateSets = validCodes.map((c) => new Set(cleanedByCode[c].map((p) => p.date)));
  const commonDates: string[] = [];
  dateSets[0].forEach((d) => {
    if (dateSets.every((s) => s.has(d))) {
      commonDates.push(d);
    }
  });

  commonDates.sort();
  if (commonDates.length < 20) {
    return {
      available: false,
      reason: `Unavailable: Only ${commonDates.length} common trading date(s) shared across validated schemes (>=20 required).`,
      codes: validCodes,
      names,
      matrix: null,
      diversificationScore: null,
    };
  }

  const returnsByCode: Record<number, number[]> = {};
  validCodes.forEach((c) => {
    const map = new Map(cleanedByCode[c].map((p) => [p.date, p.nav]));
    const rets: number[] = [];
    for (let i = 1; i < commonDates.length; i++) {
      const p1 = map.get(commonDates[i - 1])!;
      const p2 = map.get(commonDates[i])!;
      rets.push((p2 - p1) / p1);
    }
    returnsByCode[c] = rets;
  });

  const n = validCodes.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  let offDiagSum = 0;
  let offDiagCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (i < j) {
        const r1 = returnsByCode[validCodes[i]];
        const r2 = returnsByCode[validCodes[j]];
        const m1 = r1.reduce((a, b) => a + b, 0) / r1.length;
        const m2 = r2.reduce((a, b) => a + b, 0) / r2.length;
        let cov = 0;
        let v1 = 0;
        let v2 = 0;
        for (let k = 0; k < r1.length; k++) {
          const d1 = r1[k] - m1;
          const d2 = r2[k] - m2;
          cov += d1 * d2;
          v1 += d1 * d1;
          v2 += d2 * d2;
        }
        const denom = Math.sqrt(v1 * v2);
        if (denom > 1e-10) {
          const corr = cov / denom;
          const rounded = Number(corr.toFixed(2));
          matrix[i][j] = rounded;
          matrix[j][i] = rounded;
          offDiagSum += corr;
          offDiagCount++;
        } else {
          matrix[i][j] = null;
          matrix[j][i] = null;
        }
      }
    }
  }

  const diversificationScore =
    offDiagCount > 0
      ? Math.max(0, Math.min(100, Math.round((1.0 - offDiagSum / offDiagCount) * 100)))
      : null;

  return {
    available: offDiagCount > 0,
    reason: offDiagCount > 0 ? null : 'Unavailable: Zero return variance in compared series.',
    codes: validCodes,
    names,
    matrix,
    diversificationScore,
  };
}

/**
 * Pairwise stock-level portfolio overlap between two funds.
 * Returns null when either fund lacks sourced non-cash holdings; preserves genuine 0.
 */
export function computePairwiseOverlap(
  holdingsA: FundHolding[] | null | undefined,
  holdingsB: FundHolding[] | null | undefined,
  excludeCash: boolean = true
): number | null {
  if (!holdingsA?.length || !holdingsB?.length) return null;

  const validA = holdingsA.filter((h) => !excludeCash || !isCashEquivalentHolding(h));
  const validB = holdingsB.filter((h) => !excludeCash || !isCashEquivalentHolding(h));

  if (!validA.length || !validB.length) return null;

  // Sum duplicate ISIN weights per portfolio defensively
  const mapA = new Map<string, number>();
  for (const h of validA) {
    const key = h.isin.trim().toUpperCase();
    mapA.set(key, (mapA.get(key) || 0) + h.weight);
  }

  const mapB = new Map<string, number>();
  for (const h of validB) {
    const key = h.isin.trim().toUpperCase();
    mapB.set(key, (mapB.get(key) || 0) + h.weight);
  }

  let overlap = 0;
  for (const [isin, wA] of mapA.entries()) {
    const wB = mapB.get(isin);
    if (wB !== undefined) {
      overlap += Math.min(wA, wB);
    }
  }

  return Number(overlap.toFixed(2));
}

export function computeOverlapMatrix(
  funds: { scheme_code: number; name: string; holdings: FundHolding[] | null | undefined }[]
): { available: boolean; reason: string | null; names: string[]; matrix: (number | null)[][] } {
  const names = funds.map((f) => f.name);
  const n = funds.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  let anyHoldings = false;

  for (let i = 0; i < n; i++) {
    const hI = funds[i].holdings;
    if (hI && hI.length > 0) anyHoldings = true;
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = hI && hI.length > 0 ? 100.0 : null;
      } else if (i < j) {
        const ov = computePairwiseOverlap(hI, funds[j].holdings, true);
        matrix[i][j] = ov;
        matrix[j][i] = ov;
      }
    }
  }

  return {
    available: anyHoldings,
    reason: anyHoldings ? null : 'Unavailable: None of the selected schemes have verified portfolio holdings.',
    names,
    matrix,
  };
}

export function aggregateMarketCapExposure(
  funds: { holdings: FundHolding[] | null | undefined }[],
  weights?: number[]
): { available: boolean; reason: string | null; segments: { segment: string; weight: number }[] } {
  const validEntries = funds
    .map((f, idx) => ({ f, origW: weights ? weights[idx] : 1 }))
    .filter((entry) => entry.f.holdings && entry.f.holdings.length > 0);

  if (validEntries.length === 0) {
    return {
      available: false,
      reason: 'Unavailable: Verified security-level holdings are required for market-cap look-through.',
      segments: [],
    };
  }

  const totalOrigW = validEntries.reduce((acc, e) => acc + e.origW, 0) || 1;
  const totals: Record<string, number> = {
    'Large Cap': 0,
    'Mid Cap': 0,
    'Small Cap': 0,
    'Debt / Fixed Income': 0,
    'Cash / Sovereign': 0,
  };

  validEntries.forEach(({ f, origW }) => {
    const fundWeight = origW / totalOrigW;
    f.holdings!.forEach((h) => {
      totals[h.mcap] = (totals[h.mcap] || 0) + fundWeight * h.weight;
    });
  });

  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return {
      available: false,
      reason: 'Unavailable: Holdings weights sum to zero.',
      segments: [],
    };
  }

  return {
    available: true,
    reason: null,
    segments: Object.entries(totals).map(([segment, val]) => ({
      segment,
      weight: Number(((val / sum) * 100).toFixed(1)),
    })),
  };
}

export function aggregateSectorExposure(
  funds: { holdings: FundHolding[] | null | undefined }[],
  weights?: number[]
): { available: boolean; reason: string | null; sectors: { sector: string; weight: number }[] } {
  const validEntries = funds
    .map((f, idx) => ({ f, origW: weights ? weights[idx] : 1 }))
    .filter((entry) => entry.f.holdings && entry.f.holdings.length > 0);

  if (validEntries.length === 0) {
    return {
      available: false,
      reason: 'Unavailable: Verified security-level holdings are required for sector exposure.',
      sectors: [],
    };
  }

  const totalOrigW = validEntries.reduce((acc, e) => acc + e.origW, 0) || 1;
  const totals: Record<string, number> = {};

  validEntries.forEach(({ f, origW }) => {
    const fundWeight = origW / totalOrigW;
    f.holdings!.forEach((h) => {
      totals[h.sector] = (totals[h.sector] || 0) + fundWeight * h.weight;
    });
  });

  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return {
      available: false,
      reason: 'Unavailable: Sector weights sum to zero.',
      sectors: [],
    };
  }

  return {
    available: true,
    reason: null,
    sectors: Object.entries(totals)
      .map(([sector, val]) => ({
        sector,
        weight: Number(((val / sum) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.weight - a.weight),
  };
}

export function calculateLiquidityStress(
  holdings: FundHolding[] | null | undefined,
  aumCrores: number | null | undefined,
  participationRate: number = 0.1
): LiquidityStressResult {
  const unavailableBase = (
    reason: string,
    analyzed: LiquidityStressResult['holdings'] = []
  ): LiquidityStressResult => ({
    available: false,
    reason,
    days25Prorata: null,
    days50Prorata: null,
    days25Waterfall: null,
    days50Waterfall: null,
    pctLiquidUnder3Days: null,
    pctLiquid3To7Days: null,
    pctIlliquidOver10Days: null,
    holdings: analyzed,
  });

  if (!holdings?.length || !aumCrores || !Number.isFinite(aumCrores) || aumCrores <= 0) {
    return unavailableBase(
      'Unavailable: Sourced holdings and AUM are required to model portfolio liquidity stress.'
    );
  }

  let missingAdtv = false;
  const analyzed = holdings.map((h) => {
    const positionCr = (h.weight / 100.0) * aumCrores;
    const isCash = isCashEquivalentHolding(h);
    if (isCash) {
      return {
        isin: h.isin,
        name: h.name,
        weight: h.weight,
        positionCr: Number(positionCr.toFixed(2)),
        adtvCr: h.adtv_cr,
        daysToLiquidate: 0.0,
      };
    }

    if (h.adtv_cr === null || !Number.isFinite(h.adtv_cr) || h.adtv_cr <= 0) {
      missingAdtv = true;
      return {
        isin: h.isin,
        name: h.name,
        weight: h.weight,
        positionCr: Number(positionCr.toFixed(2)),
        adtvCr: h.adtv_cr ?? null,
        daysToLiquidate: null,
      };
    }

    const dailyAbsorbable = h.adtv_cr * participationRate;
    const days = dailyAbsorbable > 0 ? positionCr / dailyAbsorbable : null;
    if (days === null) missingAdtv = true;

    return {
      isin: h.isin,
      name: h.name,
      weight: h.weight,
      positionCr: Number(positionCr.toFixed(2)),
      adtvCr: h.adtv_cr,
      daysToLiquidate: days !== null ? Number(days.toFixed(1)) : null,
    };
  });

  if (missingAdtv) {
    return unavailableBase(
      'Unavailable: Verified 30D exchange ADTV is required for all non-cash holdings before liquidity stress days can be reported (Batch 5).',
      analyzed
    );
  }

  const nonCash = analyzed.filter(
    (h) =>
      !isCashEquivalentHolding({
        isin: h.isin,
        name: h.name,
        weight: h.weight,
        adtv_cr: h.adtvCr,
        sector: '',
        mcap: 'Large Cap',
      })
  );
  const maxDays = nonCash.length > 0 ? Math.max(...nonCash.map((h) => h.daysToLiquidate || 0)) : 0;
  const days25Prorata = Number((maxDays * 0.25).toFixed(1));
  const days50Prorata = Number((maxDays * 0.5).toFixed(1));

  const sorted = [...analyzed].sort(
    (a, b) => (a.daysToLiquidate ?? 0) - (b.daysToLiquidate ?? 0)
  );
  let cumW = 0;
  let days25Waterfall: number | null = null;
  let days50Waterfall: number | null = null;

  for (const h of sorted) {
    cumW += h.weight;
    if (cumW >= 25 && days25Waterfall === null) {
      days25Waterfall = h.daysToLiquidate ?? 0;
    }
    if (cumW >= 50 && days50Waterfall === null) {
      days50Waterfall = h.daysToLiquidate ?? 0;
      break;
    }
  }

  const under3 = analyzed
    .filter((h) => (h.daysToLiquidate ?? Infinity) <= 3)
    .reduce((a, b) => a + b.weight, 0);
  const threeToSeven = analyzed
    .filter((h) => (h.daysToLiquidate ?? 0) > 3 && (h.daysToLiquidate ?? Infinity) <= 7)
    .reduce((a, b) => a + b.weight, 0);
  const over10 = analyzed
    .filter((h) => (h.daysToLiquidate ?? 0) > 10)
    .reduce((a, b) => a + b.weight, 0);

  return {
    available: true,
    reason: null,
    days25Prorata,
    days50Prorata,
    days25Waterfall: days25Waterfall !== null ? Number(days25Waterfall.toFixed(1)) : null,
    days50Waterfall: days50Waterfall !== null ? Number(days50Waterfall.toFixed(1)) : null,
    pctLiquidUnder3Days: Number(under3.toFixed(1)),
    pctLiquid3To7Days: Number(threeToSeven.toFixed(1)),
    pctIlliquidOver10Days: Number(over10.toFixed(1)),
    holdings: analyzed.sort((a, b) => (b.daysToLiquidate ?? 0) - (a.daysToLiquidate ?? 0)),
  };
}

export function calculateDurationSensitivity(
  macaulayDuration: number | null | undefined,
  currentYtm: number | null | undefined,
  convexity: number | null | undefined = null,
  shockBpsList: number[] = [-200, -100, -50, 0, 50, 100, 200],
  baseNav: number = 100.0
): DurationSensitivityResult {
  if (
    macaulayDuration == null ||
    !Number.isFinite(macaulayDuration) ||
    macaulayDuration <= 0 ||
    currentYtm == null ||
    !Number.isFinite(currentYtm)
  ) {
    return {
      available: false,
      reason:
        'Unavailable: Sourced Macaulay Duration and YTM are required for fixed-income rate sensitivity modeling.',
      points: [],
    };
  }

  const effectiveConvexity = convexity != null && Number.isFinite(convexity) ? convexity : 0;
  const modDuration = currentYtm > -1 ? macaulayDuration / (1.0 + currentYtm) : macaulayDuration;

  const points = shockBpsList.map((bps) => {
    const deltaY = bps / 10000.0;
    const durImpact = -modDuration * deltaY;
    const cvxImpact = 0.5 * effectiveConvexity * Math.pow(deltaY, 2);
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

  return {
    available: true,
    reason: null,
    points,
  };
}
