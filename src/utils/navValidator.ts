import {
  AppliedCorporateAction,
  CorporateActionBreak,
  CorporateActionRecord,
  NavPoint,
  RejectedPayloadDiagnostics,
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
  valuationCutoffDate?: string;
  maxStaleDays?: number;
  identity?: SchemeIdentityAudit | null;
  returnedSchemeCode?: number | null;
  returnedSchemeName?: string | null;
  returnedIsin?: string | null;
  corporateActions?: CorporateActionRecord[];
  seriesIsin?: string | null;
}

/**
 * Verified Corporate Action Registry (Batch 2).
 * Source Circular for 113049: https://nsearchives.nseindia.com/content/circulars/CML47320.pdf
 * (NSE/CML/47320, Circular 0141/2021 dated 12-Feb-2021: HDFC Gold ETF face value Rs.100 -> Rs.1,
 * AMFI NAV split reflected from 19-Feb-2021 [4120.0604] to 22-Feb-2021 [41.5242]).
 */
export const VERIFIED_CORPORATE_ACTIONS: Record<number, CorporateActionRecord[]> = {
  113049: [
    {
      actionId: 'NSE-CML-47320-113049-SPLIT-100-1',
      schemeCode: 113049,
      actionType: 'unit_split',
      factor: 100,
      effectiveDate: '2021-02-22',
      preActionIsin: 'INF179KC1981',
      postActionIsin: 'INF179KC1981',
      sourceCircular: 'https://nsearchives.nseindia.com/content/circulars/CML47320.pdf',
      description:
        'HDFC Gold ETF 100:1 face-value split (Rs. 100 -> Rs. 1 per unit per NSE Circular NSE/CML/47320, AMFI post-split NAV effective 2021-02-22).',
      verified: true,
    },
  ],
};

/**
 * Returns today's calendar date (YYYY-MM-DD) in India Standard Time (Asia/Kolkata).
 */
export function getIndiaValuationDateIso(now: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback to explicit IST offset (+05:30) if Intl timezone formatting fails
  }
  const istMs = now.getTime() + 330 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
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

export interface ApplyCorporateActionsOptions {
  schemeCode?: number;
  seriesIsin?: string | null;
  preSplitIsin?: string | null;
  postSplitIsin?: string | null;
  alreadyAppliedActionIds?: string[];
}

export interface ApplyCorporateActionsResult {
  rawPoints: NavPoint[];
  adjustedPoints: NavPoint[];
  appliedActionIds: string[];
  appliedCorporateActions: AppliedCorporateAction[];
  adjustedApplied: boolean;
  warnings: string[];
}

/**
 * Idempotently constructs a corporate-action-adjusted NAV history alongside the untouched raw history.
 * - Rejects unverified actions, nonpositive factors, and mismatched ISIN mappings.
 * - Never re-applies an action whose actionId is already recorded in appliedActionIds.
 * - Preserves rawPoints verbatim and keeps out-of-window histories untouched.
 */
export function applyCorporateActionsToPoints(
  sortedValidRawPoints: NavPoint[],
  corporateActions: CorporateActionRecord[],
  options: ApplyCorporateActionsOptions = {}
): ApplyCorporateActionsResult {
  const rawPoints = sortedValidRawPoints.map((p) => ({ date: p.date, nav: p.nav }));
  const currentAdjusted = sortedValidRawPoints.map((p) => ({ date: p.date, nav: p.nav }));
  const appliedActionIds = new Set<string>(options.alreadyAppliedActionIds || []);
  const appliedCorporateActions: AppliedCorporateAction[] = [];
  const warnings: string[] = [];

  if (rawPoints.length === 0 || !corporateActions || corporateActions.length === 0) {
    return {
      rawPoints,
      adjustedPoints: currentAdjusted,
      appliedActionIds: Array.from(appliedActionIds),
      appliedCorporateActions,
      adjustedApplied: false,
      warnings,
    };
  }

  const orderedActions = [...corporateActions].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate)
  );
  const schemeIsin = (options.seriesIsin || '').trim().toUpperCase() || null;
  const preIsinOverride = (options.preSplitIsin || '').trim().toUpperCase() || null;
  const postIsinOverride = (options.postSplitIsin || '').trim().toUpperCase() || null;

  let anyAdjusted = false;

  for (const action of orderedActions) {
    if (!action || !action.verified) continue;
    if (options.schemeCode && action.schemeCode !== options.schemeCode) continue;
    if (!isValidIsoCalendarDate(action.effectiveDate)) continue;
    if (!Number.isFinite(action.factor) || action.factor <= 0) continue;

    // Idempotency guard: never divide twice for an already applied actionId
    if (appliedActionIds.has(action.actionId)) {
      continue;
    }

    const expectedPreIsin = action.preActionIsin ? action.preActionIsin.trim().toUpperCase() : null;
    const expectedPostIsin = action.postActionIsin.trim().toUpperCase();

    // Effective pre/post ISIN mapping verification
    const effectiveIsinToCheck = postIsinOverride || schemeIsin;
    if (effectiveIsinToCheck && effectiveIsinToCheck !== expectedPostIsin) {
      warnings.push(
        `Skipped corporate action ${action.actionId}: scheme ISIN ${effectiveIsinToCheck} does not match expected post-action ISIN ${expectedPostIsin}.`
      );
      appliedCorporateActions.push({
        actionId: action.actionId,
        schemeCode: action.schemeCode,
        actionType: action.actionType,
        factor: action.factor,
        effectiveDate: action.effectiveDate,
        preActionIsin: action.preActionIsin,
        postActionIsin: action.postActionIsin,
        sourceCircular: action.sourceCircular,
        affectedObservationCount: 0,
        windowStatus: 'isin_mismatch_skipped',
      });
      continue;
    }
    if (preIsinOverride && expectedPreIsin && preIsinOverride !== expectedPreIsin) {
      warnings.push(
        `Skipped corporate action ${action.actionId}: pre-split ISIN ${preIsinOverride} does not match expected pre-action ISIN ${expectedPreIsin}.`
      );
      appliedCorporateActions.push({
        actionId: action.actionId,
        schemeCode: action.schemeCode,
        actionType: action.actionType,
        factor: action.factor,
        effectiveDate: action.effectiveDate,
        preActionIsin: action.preActionIsin,
        postActionIsin: action.postActionIsin,
        sourceCircular: action.sourceCircular,
        affectedObservationCount: 0,
        windowStatus: 'isin_mismatch_skipped',
      });
      continue;
    }

    const preBoundaryRaw = [...rawPoints]
      .reverse()
      .find((p) => p.date < action.effectiveDate && p.nav > 0);
    const postBoundaryRaw = rawPoints.find((p) => p.date >= action.effectiveDate && p.nav > 0);

    let affectedCount = 0;
    for (let i = 0; i < currentAdjusted.length; i++) {
      if (currentAdjusted[i].date < action.effectiveDate && currentAdjusted[i].nav > 0) {
        currentAdjusted[i] = {
          date: currentAdjusted[i].date,
          nav: Number((currentAdjusted[i].nav / action.factor).toFixed(6)),
        };
        affectedCount++;
      }
    }

    appliedActionIds.add(action.actionId);

    if (affectedCount === 0) {
      appliedCorporateActions.push({
        actionId: action.actionId,
        schemeCode: action.schemeCode,
        actionType: action.actionType,
        factor: action.factor,
        effectiveDate: action.effectiveDate,
        preActionIsin: action.preActionIsin,
        postActionIsin: action.postActionIsin,
        sourceCircular: action.sourceCircular,
        affectedObservationCount: 0,
        windowStatus: 'out_of_window',
      });
      continue;
    }

    anyAdjusted = true;
    const preBoundaryAdj = preBoundaryRaw
      ? Number((preBoundaryRaw.nav / action.factor).toFixed(6))
      : null;
    const adjReturnPct =
      preBoundaryAdj && preBoundaryAdj > 0 && postBoundaryRaw
        ? Number((((postBoundaryRaw.nav / preBoundaryAdj) - 1) * 100).toFixed(2))
        : null;

    appliedCorporateActions.push({
      actionId: action.actionId,
      schemeCode: action.schemeCode,
      actionType: action.actionType,
      factor: action.factor,
      effectiveDate: action.effectiveDate,
      preActionIsin: action.preActionIsin,
      postActionIsin: action.postActionIsin,
      sourceCircular: action.sourceCircular,
      affectedObservationCount: affectedCount,
      windowStatus: 'applied',
      rawPreSplitBoundaryNav: preBoundaryRaw?.nav ?? null,
      rawPostSplitBoundaryNav: postBoundaryRaw?.nav ?? null,
      adjustedPreSplitBoundaryNav: preBoundaryAdj,
      adjustedBoundaryReturnPct: adjReturnPct,
    });

    warnings.push(
      `Applied verified corporate action ${action.actionId} (factor ${action.factor}:1 effective ${action.effectiveDate}) to ${affectedCount} pre-split observation(s).`
    );
  }

  return {
    rawPoints,
    adjustedPoints: currentAdjusted,
    appliedActionIds: Array.from(appliedActionIds),
    appliedCorporateActions,
    adjustedApplied: anyAdjusted,
    warnings,
  };
}

/**
 * Idempotently applies verified corporate actions to an existing ValidatedNavSeries.
 * Guarantees re-applying the same corporateAction.actionId never divides twice.
 */
export function applyCorporateActionsToSeries(
  series: ValidatedNavSeries,
  corporateActions?: CorporateActionRecord[],
  options: Omit<ApplyCorporateActionsOptions, 'schemeCode' | 'alreadyAppliedActionIds'> = {}
): ValidatedNavSeries {
  if (!series.validation.usable || series.points.length === 0) {
    return series;
  }

  const actions =
    corporateActions ?? VERIFIED_CORPORATE_ACTIONS[series.schemeCode] ?? [];
  const rawBase = series.rawPoints && series.rawPoints.length > 0 ? series.rawPoints : series.points;
  const alreadyApplied = series.appliedActionIds || [];

  const pendingActions = actions.filter((a) => !alreadyApplied.includes(a.actionId));
  if (pendingActions.length === 0) {
    return series;
  }

  const baseForAdjust = series.adjustedPoints && series.adjustedPoints.length > 0
    ? series.adjustedPoints
    : series.points;

  const adjResult = applyCorporateActionsToPoints(baseForAdjust, pendingActions, {
    ...options,
    schemeCode: series.schemeCode,
    seriesIsin: options.seriesIsin ?? series.identity?.providerIsin ?? series.identity?.registryIsin,
    alreadyAppliedActionIds: alreadyApplied,
  });

  if (!adjResult.adjustedApplied && adjResult.appliedCorporateActions.length === 0) {
    return series;
  }

  const remainingBreaks = detectCorporateActionBreaks(adjResult.adjustedPoints);
  const quarantinedFromBreak = remainingBreaks.length > 0;
  const mergedAppliedActions = [
    ...(series.validation.appliedCorporateActions || []),
    ...adjResult.appliedCorporateActions,
  ];
  const mergedWarnings = [...series.validation.warnings, ...adjResult.warnings];
  for (const brk of remainingBreaks) {
    if (!mergedWarnings.includes(brk.explanation)) {
      mergedWarnings.push(brk.explanation);
    }
  }

  return {
    ...series,
    points: adjResult.adjustedPoints,
    rawPoints: rawBase,
    adjustedPoints: adjResult.adjustedPoints,
    appliedActionIds: adjResult.appliedActionIds,
    validation: {
      ...series.validation,
      status: quarantinedFromBreak ? 'quarantined_partial' : 'valid',
      corporateActionBreaks: remainingBreaks,
      appliedCorporateActions: mergedAppliedActions,
      adjustedApplied: Boolean(series.validation.adjustedApplied || adjResult.adjustedApplied),
      quarantinedFromBreak,
      warnings: mergedWarnings,
    },
  };
}

function buildSampleObservations(
  rawItems: MfapiRawNavItem[],
  provider: string,
  cutoffIso: string,
  limit: number = 5
): RawNavObservation[] {
  const samples: RawNavObservation[] = [];
  for (const item of rawItems.slice(0, limit)) {
    const rawDateStr = String(item?.date ?? '');
    const parsedIso = parseMfapiDateToIso(rawDateStr);
    const parsedNav =
      typeof item?.nav === 'number'
        ? item.nav
        : typeof item?.nav === 'string' && item.nav.trim() !== ''
        ? Number(item.nav.trim())
        : NaN;

    const status: RawNavObservation['status'] = !parsedIso
      ? 'invalid_date'
      : !Number.isFinite(parsedNav)
      ? 'nonfinite_nav'
      : parsedNav <= 0
      ? 'nonpositive_nav'
      : parsedIso > cutoffIso
      ? 'post_cutoff_nav'
      : 'valid';

    samples.push({
      rawDate: rawDateStr,
      date: parsedIso,
      rawNav: item?.nav ?? '',
      nav: Number.isFinite(parsedNav) ? parsedNav : null,
      source: provider,
      status,
    });
  }
  return samples;
}

export function validateRawNavSeries(
  rawItems: MfapiRawNavItem[] | null | undefined,
  options: ValidateNavOptions = {}
): ValidatedNavSeries {
  const schemeCode = options.schemeCode ?? 0;
  const provider = options.provider ?? 'api.mfapi.in';
  const fetchedAt = new Date().toISOString();
  const maxStaleDays = options.maxStaleDays ?? 14;
  const cutoffIso =
    options.valuationCutoffDate && isValidIsoCalendarDate(options.valuationCutoffDate)
      ? options.valuationCutoffDate
      : options.referenceDate && isValidIsoCalendarDate(options.referenceDate)
      ? options.referenceDate
      : getIndiaValuationDateIso();
  const identity = options.identity ?? null;

  const resolvedReturnedCode =
    options.returnedSchemeCode !== undefined
      ? options.returnedSchemeCode
      : identity?.providerSchemeCode ?? null;
  const resolvedReturnedName =
    options.returnedSchemeName !== undefined
      ? options.returnedSchemeName
      : identity?.providerName ?? null;
  const resolvedReturnedIsin =
    options.returnedIsin !== undefined
      ? options.returnedIsin
      : identity?.providerIsin ?? null;

  // CRITICAL (MF-006): If identity failed verification, NEVER attribute rejected payload counts or dates
  // to the requested scheme's validated coverage. Store them strictly inside rejectedPayloadDiagnostics.
  if (identity && !identity.verified) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    const reason = identity.reason || 'Scheme identity verification failed.';
    const diagnostics: RejectedPayloadDiagnostics = {
      requestedSchemeCode: schemeCode,
      returnedSchemeCode: resolvedReturnedCode,
      returnedSchemeName: resolvedReturnedName,
      returnedIsin: resolvedReturnedIsin,
      reason,
      totalRawCount: items.length,
      sampleObservations: buildSampleObservations(items, provider, cutoffIso, 5),
    };

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
        rejectedPayloadDiagnostics: diagnostics,
      },
    };
  }

  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    const emptyReason = 'Empty NAV response from provider.';
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
        unavailableReason: emptyReason,
        warnings: ['Empty NAV payload received.'],
        rejectedPayloadDiagnostics: {
          requestedSchemeCode: schemeCode,
          returnedSchemeCode: resolvedReturnedCode,
          returnedSchemeName: resolvedReturnedName,
          returnedIsin: resolvedReturnedIsin,
          reason: emptyReason,
          totalRawCount: 0,
          sampleObservations: [],
        },
      },
    };
  }

  const rawObservations: RawNavObservation[] = [];
  const validByDate = new Map<string, number>();
  const conflictMap = new Map<string, Set<number>>();

  let rejectedInvalidDateCount = 0;
  let rejectedNonPositiveCount = 0;
  let rejectedNonFiniteCount = 0;
  let rejectedPostCutoffCount = 0;
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

    // MF-008: Enforce India valuation cutoff BEFORE duplicate tracking, freshness, or return windows
    if (parsedIso > cutoffIso) {
      rejectedPostCutoffCount++;
      rawObservations.push({
        rawDate: rawDateStr,
        date: parsedIso,
        rawNav: item.nav,
        nav: parsedNav,
        source: provider,
        status: 'post_cutoff_nav',
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
  if (rejectedPostCutoffCount > 0) {
    warnings.push(
      `Rejected ${rejectedPostCutoffCount} post-cutoff NAV observation(s) dated after India valuation cutoff ${cutoffIso}.`
    );
  }
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
    const conflictReason = `Duplicate date conflict on ${conflictDates} (same date reported with differing NAVs).`;
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
        valuationCutoffDate: cutoffIso,
        totalRawCount: 0,
        validCount: 0,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        rejectedPostCutoffCount,
        duplicateIdenticalCount,
        duplicateConflicts,
        earliestDate: null,
        latestDate: null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: conflictReason,
        warnings,
        rejectedPayloadDiagnostics: {
          requestedSchemeCode: schemeCode,
          returnedSchemeCode: resolvedReturnedCode,
          returnedSchemeName: resolvedReturnedName,
          returnedIsin: resolvedReturnedIsin,
          reason: conflictReason,
          totalRawCount: rawItems.length,
          sampleObservations: rawObservations.slice(0, 5),
        },
      },
    };
  }

  if (sortedPoints.length === 0) {
    const noValidReason =
      rejectedPostCutoffCount > 0
        ? `Rejected ${rejectedPostCutoffCount} post-cutoff NAV observation(s) dated after ${cutoffIso}; no valid observations remained.`
        : 'No valid finite positive NAV observations remained after validation.';
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
        valuationCutoffDate: cutoffIso,
        totalRawCount: rawItems.length,
        validCount: 0,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        rejectedPostCutoffCount,
        duplicateIdenticalCount,
        duplicateConflicts: [],
        earliestDate: null,
        latestDate: null,
        isStale: false,
        staleDays: null,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: noValidReason,
        warnings,
        rejectedPayloadDiagnostics: {
          requestedSchemeCode: schemeCode,
          returnedSchemeCode: resolvedReturnedCode,
          returnedSchemeName: resolvedReturnedName,
          returnedIsin: resolvedReturnedIsin,
          reason: noValidReason,
          totalRawCount: rawItems.length,
          sampleObservations: rawObservations.slice(0, 5),
        },
      },
    };
  }

  const earliestDate = sortedPoints[0].date;
  const latestDate = sortedPoints[sortedPoints.length - 1].date;
  const refMs = Date.parse(`${cutoffIso}T00:00:00Z`);
  const latestMs = Date.parse(`${latestDate}T00:00:00Z`);
  const staleDays = Math.round((refMs - latestMs) / 86400000);
  const isStale = staleDays > maxStaleDays;

  if (isStale) {
    const staleReason = `Stale NAV series: latest on-or-before-cutoff observation ${latestDate} is ${staleDays} days behind cutoff ${cutoffIso} (threshold: ${maxStaleDays} days).`;
    warnings.push(staleReason);
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
        valuationCutoffDate: cutoffIso,
        totalRawCount: 0,
        validCount: 0,
        rejectedInvalidDateCount,
        rejectedNonPositiveCount,
        rejectedNonFiniteCount,
        rejectedPostCutoffCount,
        duplicateIdenticalCount,
        duplicateConflicts: [],
        earliestDate: null,
        latestDate: null,
        isStale: true,
        staleDays,
        corporateActionBreaks: [],
        quarantinedFromBreak: false,
        unavailableReason: staleReason,
        warnings,
        rejectedPayloadDiagnostics: {
          requestedSchemeCode: schemeCode,
          returnedSchemeCode: resolvedReturnedCode,
          returnedSchemeName: resolvedReturnedName,
          returnedIsin: resolvedReturnedIsin,
          reason: `${staleReason} (Rejected series span: ${earliestDate} to ${latestDate}, ${sortedPoints.length} valid pre-cutoff obs.)`,
          totalRawCount: rawItems.length,
          sampleObservations: buildSampleObservations(rawItems, provider, cutoffIso, 5),
        },
      },
    };
  }

  const effectiveActions =
    options.corporateActions !== undefined
      ? options.corporateActions
      : VERIFIED_CORPORATE_ACTIONS[schemeCode] ?? [];

  const effectiveIsin =
    options.seriesIsin ??
    identity?.registryIsin ??
    identity?.providerIsin ??
    resolvedReturnedIsin;

  const adjResult = applyCorporateActionsToPoints(sortedPoints, effectiveActions, {
    schemeCode,
    seriesIsin: effectiveIsin,
  });

  const finalAdjustedPoints = adjResult.adjustedPoints;
  for (const w of adjResult.warnings) {
    warnings.push(w);
  }

  // Run break detection on the adjusted series so verified resolved splits clear quarantine,
  // while ANY unresolved break without a verified corporate-action record stays quarantined.
  const corporateActionBreaks = detectCorporateActionBreaks(finalAdjustedPoints);
  const quarantinedFromBreak = corporateActionBreaks.length > 0;
  for (const brk of corporateActionBreaks) {
    warnings.push(brk.explanation);
  }

  return {
    schemeCode,
    points: finalAdjustedPoints,
    rawPoints: adjResult.rawPoints,
    adjustedPoints: finalAdjustedPoints,
    appliedActionIds: adjResult.appliedActionIds,
    rawObservations,
    identity,
    validation: {
      status: quarantinedFromBreak ? 'quarantined_partial' : 'valid',
      usable: true,
      provider,
      fetchedAt,
      valuationCutoffDate: cutoffIso,
      totalRawCount: rawItems.length,
      validCount: finalAdjustedPoints.length,
      rejectedInvalidDateCount,
      rejectedNonPositiveCount,
      rejectedNonFiniteCount,
      rejectedPostCutoffCount,
      duplicateIdenticalCount,
      duplicateConflicts: [],
      earliestDate,
      latestDate,
      rawEarliestDate: earliestDate,
      rawLatestDate: latestDate,
      isStale: false,
      staleDays,
      corporateActionBreaks,
      appliedCorporateActions: adjResult.appliedCorporateActions,
      adjustedApplied: adjResult.adjustedApplied,
      quarantinedFromBreak,
      unavailableReason: null,
      warnings,
      rejectedPayloadDiagnostics: null,
    },
  };
}

