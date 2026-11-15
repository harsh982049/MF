import {
  CorporateActionBreak,
  NavPoint,
  NavValidationReport,
  RawNavObservation,
  SchemeIdentityAudit,
  ValidatedNavSeries,
} from '../types/quant';

export interface MfapiRawNavItem {
  date: string;
  nav: string | number;
}

export interface ValidateNavOptions {
  schemeCode?: number;
  provider?: string;
  referenceDate?: string;
  maxStaleDays?: number;
  identity?: SchemeIdentityAudit | null;
}

export function isValidIsoCalendarDate(iso: string): boolean {
  if (!iso || typeof iso !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;

  const [yStr, mStr, dStr] = iso.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseMfapiDateToIso(rawDate: string): string | null {
  if (!rawDate || typeof rawDate !== 'string') return null;
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidIsoCalendarDate(trimmed) ? trimmed : null;
  }
  const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const iso = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    return isValidIsoCalendarDate(iso) ? iso : null;
  }
  return null;
}

/**
 * Detects large single-session discontinuities consistent with unadjusted corporate actions
 * (e.g. HDFC Gold ETF 100:1 split on 22-Feb-2021 where NAV moved from 4120.0604 to 41.5242, -98.99%).
 */
export function detectCorporateActionBreaks(sortedPoints: NavPoint[]): CorporateActionBreak[] {
  if (!sortedPoints || sortedPoints.length < 2) return [];
  const breaks: CorporateActionBreak[] = [];

  for (let i = 1; i < sortedPoints.length; i++) {
    const prev = sortedPoints[i - 1];
    const curr = sortedPoints[i];
    if (prev.nav <= 0 || curr.nav <= 0) continue;

    const ratio = curr.nav / prev.nav;
    const pctChange = ratio - 1.0;

    if (pctChange <= -0.45 || pctChange >= 1.5) {
      breaks.push({
        prevDate: prev.date,
        prevNav: prev.nav,
        date: curr.date,
        nav: curr.nav,
        pctChange: Number((pctChange * 100).toFixed(2)),
        ratio: Number(ratio.toFixed(6)),
        status: 'unresolved_quarantined',
        explanation: `Unresolved corporate-action break between ${prev.date} (${prev.nav}) and ${curr.date} (${curr.nav}; ${(pctChange * 100).toFixed(2)}%). Split-spanning analytics quarantined pending split-factor validation (Batch 2).`,
      });
    }
  }

  return breaks;
}

/**
 * Returns the first corporate-action break spanned by [startDate, endDate], if any.
 */
export function doesWindowSpanCorporateActionBreak(
  startDate: string,
  endDate: string,
  breaks: CorporateActionBreak[]
): CorporateActionBreak | null {
  if (!breaks || breaks.length === 0) return null;
  for (const brk of breaks) {
    if (startDate < brk.date && endDate >= brk.date) {
      return brk;
    }
  }
  return null;
}

export function validateRawNavSeries(
  rawItems: MfapiRawNavItem[] | null | undefined,
  options: ValidateNavOptions = {}
): ValidatedNavSeries {
  const schemeCode = options.schemeCode ?? 0;
  const provider = options.provider ?? 'api.mfapi.in';
  const fetchedAt = new Date().toISOString();
  const maxStaleDays = options.maxStaleDays ?? 14;
  const refDateIso =
    options.referenceDate && isValidIsoCalendarDate(options.referenceDate)
      ? options.referenceDate
      : fetchedAt.slice(0, 10);
  const identity = options.identity ?? null;

  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      schemeCode,
      points: [],
      rawObservations: [],
      identity,
      validation: {
        status: 'unavailable',
        usable: false,
        provider,
        fetchedAt,
        totalRawCount: 0,
        validCount: 0,
        rejectedInvalidDateCount: 0,
        rejectedNonPositiveCount: 0,
        rejectedNonFiniteCount: 0,
        duplicateIdenticalCount: 0,
        duplicateConflicts: [],
        earliestDate: null,
        latestDate: null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: 'Empty NAV response from provider.',
        warnings: ['Empty NAV payload received.'],
      },
    };
  }

  const rawObservations: RawNavObservation[] = [];
  const validByDate = new Map<string, number>();
  const conflictMap = new Map<string, Set<number>>();

  let rejectedInvalidDateCount = 0;
  let rejectedNonPositiveCount = 0;
  let rejectedNonFiniteCount = 0;
  let duplicateIdenticalCount = 0;

  for (const item of rawItems) {
    const rawDateStr = String(item?.date ?? '');
    const parsedIso = parseMfapiDateToIso(rawDateStr);
    const parsedNav =
      typeof item?.nav === 'number'
        ? item.nav
        : typeof item?.nav === 'string' && item.nav.trim() !== ''
        ? Number(item.nav.trim())
        : NaN;

    if (!parsedIso) {
      rejectedInvalidDateCount++;
      rawObservations.push({
        rawDate: rawDateStr,
        date: null,
        rawNav: item?.nav ?? '',
        nav: Number.isFinite(parsedNav) ? parsedNav : null,
        source: provider,
        status: 'invalid_date',
      });
      continue;
    }

    if (!Number.isFinite(parsedNav)) {
      rejectedNonFiniteCount++;
      rawObservations.push({
        rawDate: rawDateStr,
        date: parsedIso,
        rawNav: item?.nav ?? '',
        nav: null,
        source: provider,
        status: 'nonfinite_nav',
      });
      continue;
    }

    if (parsedNav <= 0) {
      rejectedNonPositiveCount++;
      rawObservations.push({
        rawDate: rawDateStr,
        date: parsedIso,
        rawNav: item?.nav ?? '',
        nav: parsedNav,
        source: provider,
        status: 'nonpositive_nav',
      });
      continue;
    }

    const existing = validByDate.get(parsedIso);
    if (existing !== undefined) {
      if (Math.abs(existing - parsedNav) <= 1e-8) {
        duplicateIdenticalCount++;
        rawObservations.push({
          rawDate: rawDateStr,
          date: parsedIso,
          rawNav: item.nav,
          nav: parsedNav,
          source: provider,
          status: 'duplicate_identical',
        });
      } else {
        const set = conflictMap.get(parsedIso) || new Set<number>([existing]);
        set.add(parsedNav);
        conflictMap.set(parsedIso, set);
        rawObservations.push({
          rawDate: rawDateStr,
          date: parsedIso,
          rawNav: item.nav,
          nav: parsedNav,
          source: provider,
          status: 'duplicate_conflict',
        });
      }
      continue;
    }

    validByDate.set(parsedIso, parsedNav);
    rawObservations.push({
      rawDate: rawDateStr,
      date: parsedIso,
      rawNav: item.nav,
      nav: parsedNav,
      source: provider,
      status: 'valid',
    });
  }

  const duplicateConflicts = Array.from(conflictMap.entries()).map(([date, set]) => ({
    date,
    values: Array.from(set.values()),
  }));

  const sortedPoints: NavPoint[] = Array.from(validByDate.entries())
    .map(([date, nav]) => ({ date, nav }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const warnings: string[] = [];
  if (rejectedInvalidDateCount > 0) {
    warnings.push(`Rejected ${rejectedInvalidDateCount} observation(s) with invalid calendar dates.`);
  }
  if (rejectedNonFiniteCount > 0) {
    warnings.push(`Rejected ${rejectedNonFiniteCount} observation(s) with non-finite NAVs.`);
  }
  if (rejectedNonPositiveCount > 0) {
    warnings.push(`Rejected ${rejectedNonPositiveCount} observation(s) with zero or negative NAVs.`);
  }
  if (duplicateIdenticalCount > 0) {
    warnings.push(`Deduplicated ${duplicateIdenticalCount} identical duplicate date observation(s).`);
  }

  if (duplicateConflicts.length > 0) {
    const conflictDates = duplicateConflicts.map((c) => c.date).slice(0, 3).join(', ');
    warnings.push(`Detected ${duplicateConflicts.length} conflicting duplicate NAV date(s): ${conflictDates}.`);
    return {
      schemeCode,
      points: [],
      rawObservations,
      identity,
      validation: {
        status: 'unavailable',
        usable: false,
        provider,
        fetchedAt,
        totalRawCount: rawItems.length,
        validCount: sortedPoints.length,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        duplicateIdenticalCount,
        duplicateConflicts,
        earliestDate: sortedPoints[0]?.date ?? null,
        latestDate: sortedPoints[sortedPoints.length - 1]?.date ?? null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: `Duplicate date conflict on ${conflictDates} (same date reported with differing NAVs).`,
        warnings,
      },
    };
  }

  if (sortedPoints.length === 0) {
    return {
      schemeCode,
      points: [],
      rawObservations,
      identity,
      validation: {
        status: 'unavailable',
        usable: false,
        provider,
        fetchedAt,
        totalRawCount: rawItems.length,
        validCount: 0,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        duplicateIdenticalCount,
        duplicateConflicts: [],
        earliestDate: null,
        latestDate: null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: 'No valid finite positive NAV observations remained after validation.',
        warnings,
      },
    };
  }

  const earliestDate = sortedPoints[0].date;
  const latestDate = sortedPoints[sortedPoints.length - 1].date;
  const refMs = Date.parse(`${refDateIso}T00:00:00Z`);
  const latestMs = Date.parse(`${latestDate}T00:00:00Z`);
  const staleDays = Math.round((refMs - latestMs) / 86400000);
  const isStale = staleDays > maxStaleDays;

  if (isStale) {
    warnings.push(
      `Stale NAV series: latest observation ${latestDate} is ${staleDays} days behind reference date ${refDateIso} (max allowed ${maxStaleDays} days).`
    );
  }

  const corporateActionBreaks = detectCorporateActionBreaks(sortedPoints);
  const quarantinedFromBreak = corporateActionBreaks.length > 0;
  for (const brk of corporateActionBreaks) {
    warnings.push(brk.explanation);
  }

  // If identity failed verification, the series must not be used as verified scheme analytics
  if (identity && !identity.verified) {
    return {
      schemeCode,
      points: [],
      rawObservations,
      identity,
      validation: {
        status: 'unavailable',
        usable: false,
        provider,
        fetchedAt,
        totalRawCount: rawItems.length,
        validCount: sortedPoints.length,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        duplicateIdenticalCount,
        duplicateConflicts: [],
        earliestDate,
        latestDate,
        isStale,
        staleDays,
        corporateActionBreaks,
        quarantinedFromBreak,
        unavailableReason: identity.reason || 'Scheme identity verification failed.',
        warnings,
      },
    };
  }

  if (isStale) {
    return {
      schemeCode,
      points: [],
      rawObservations,
      identity,
      validation: {
        status: 'stale',
        usable: false,
        provider,
        fetchedAt,
        totalRawCount: rawItems.length,
        validCount: sortedPoints.length,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        duplicateIdenticalCount,
        duplicateConflicts: [],
        earliestDate,
        latestDate,
        isStale: true,
        staleDays,
        corporateActionBreaks,
        quarantinedFromBreak,
        unavailableReason: `Stale NAV series: latest observation ${latestDate} is ${staleDays} days old (threshold: ${maxStaleDays} days).`,
        warnings,
      },
    };
  }

  return {
    schemeCode,
    points: sortedPoints,
    rawObservations,
    identity,
    validation: {
      status: quarantinedFromBreak ? 'quarantined_partial' : 'valid',
      usable: true,
      provider,
      fetchedAt,
      totalRawCount: rawItems.length,
      validCount: sortedPoints.length,
      rejectedInvalidDateCount,
      rejectedNonPositiveCount,
      rejectedNonFiniteCount,
      duplicateIdenticalCount,
      duplicateConflicts: [],
      earliestDate,
      latestDate,
      isStale: false,
      staleDays,
      corporateActionBreaks,
      quarantinedFromBreak,
      unavailableReason: null,
      warnings,
    },
  };
}
