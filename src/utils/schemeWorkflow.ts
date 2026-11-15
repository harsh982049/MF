import {
  FundMeta,
  NavValidationReport,
  OptionType,
  PlanType,
  SchemeIdentityAudit,
  ValidatedNavSeries,
} from '../types/quant';
import { PRESET_FUNDS, fetchLiveMfNav, validateMfapiPayload } from '../data/presetFunds';
import { classifyAndBuildFundMeta, MfapiMeta } from './mfapiClassifier';
import { MfapiRawNavItem, validateRawNavSeries } from './navValidator';
import {
  PRESET_RECONCILIATION_TABLE,
  ProviderSchemeMeta,
  TRUSTED_AMFI_REGISTRY,
  TrustedRegistryEntry,
  validateDiscoveredSchemeIdentity,
  validateSchemeIdentity,
} from './schemeIdentity';

export interface SchemeExpectationInput {
  requestedCode: number;
  expectedName?: string;
  expectedPlan?: PlanType;
  expectedOption?: OptionType;
  expectedIsin?: string | null;
}

export interface PreviewSchemeOptions extends SchemeExpectationInput {
  trustedRegistry?: Record<number, TrustedRegistryEntry>;
  valuationCutoffDate?: string;
  maxStaleDays?: number;
  fetchImpl?: typeof fetch;
}

export interface SchemePreviewResult {
  accepted: boolean;
  shouldCachePreview: boolean;
  analyticsSuppressed: boolean;
  scheme_code: number;
  scheme_name: string;
  fund_house?: string;
  scheme_category?: string;
  scheme_type?: string;
  isin_growth?: string | null;
  isin_div_reinvestment?: string | null;
  latestNav: string | null;
  latestDate: string | null;
  identity: SchemeIdentityAudit;
  navValidation: NavValidationReport | null;
  previewError: string | null;
}

export interface AddSchemeWorkflowOptions extends SchemeExpectationInput {
  selectedCodes: number[];
  customFunds: Record<number, FundMeta>;
  validatedSeriesMap: Record<number, ValidatedNavSeries>;
  allFunds?: Record<number, FundMeta>;
  trustedRegistry?: Record<number, TrustedRegistryEntry>;
  valuationCutoffDate?: string;
  maxStaleDays?: number;
  fetchImpl?: typeof fetch;
}

export interface AddSchemeWorkflowResult {
  ok: boolean;
  message: string;
  fundMeta: FundMeta | null;
  validatedSeries: ValidatedNavSeries | null;
  nextSelectedCodes: number[];
  nextCustomFunds: Record<number, FundMeta>;
  nextValidatedSeriesMap: Record<number, ValidatedNavSeries>;
}

/**
 * Shared Preview workflow used by FundSearchModal and regression tests.
 * Compares requestedCode against returned scheme_code and enforces trusted registry + NAV cutoff/freshness
 * BEFORE accepting or caching any preview state.
 */
export async function previewSchemeWorkflow(
  options: PreviewSchemeOptions
): Promise<SchemePreviewResult> {
  const {
    requestedCode,
    expectedName,
    expectedPlan,
    expectedOption,
    expectedIsin,
    trustedRegistry = TRUSTED_AMFI_REGISTRY,
    valuationCutoffDate,
    maxStaleDays = 14,
    fetchImpl = fetch,
  } = options;

  const fallbackDisplayName = expectedName || `Scheme ${requestedCode}`;
  const rec = PRESET_RECONCILIATION_TABLE[requestedCode];
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
      trustedRegistry
    );
    return {
      accepted: false,
      shouldCachePreview: false,
      analyticsSuppressed: true,
      scheme_code: requestedCode,
      scheme_name: fallbackDisplayName,
      latestNav: null,
      latestDate: null,
      identity: blockedIdentity,
      navValidation: null,
      previewError: rec.reason,
    };
  }

  try {
    const resp = await fetchImpl(`https://api.mfapi.in/mf/${requestedCode}/latest`);
    if (!resp.ok) {
      const errorIdentity = validateDiscoveredSchemeIdentity(null, {
        requestedCode,
        expectedName,
        expectedPlan,
        expectedOption,
        expectedIsin,
        trustedRegistry,
      });
      return {
        accepted: false,
        shouldCachePreview: false,
        analyticsSuppressed: true,
        scheme_code: requestedCode,
        scheme_name: fallbackDisplayName,
        latestNav: null,
        latestDate: null,
        identity: errorIdentity,
        navValidation: null,
        previewError: `Provider preview failed (HTTP ${resp.status}).`,
      };
    }

    const json = (await resp.json()) as {
      meta?: Partial<ProviderSchemeMeta> & {
        fund_house?: string;
        scheme_category?: string;
        scheme_type?: string;
      };
      data?: MfapiRawNavItem[];
    };

    const providerMeta = json?.meta
      ? {
          scheme_code: Number(json.meta.scheme_code),
          scheme_name: String(json.meta.scheme_name || ''),
          isin_growth: json.meta.isin_growth ?? null,
          isin_div_reinvestment: json.meta.isin_div_reinvestment ?? null,
          fund_house: json.meta.fund_house,
          scheme_category: json.meta.scheme_category,
          scheme_type: json.meta.scheme_type,
        }
      : null;

    const presetMeta = PRESET_FUNDS[requestedCode];
    const identity = presetMeta
      ? validateSchemeIdentity(
          {
            scheme_code: presetMeta.scheme_code,
            name: expectedName || presetMeta.identityStatus.expectedName,
            plan: expectedPlan || presetMeta.identityStatus.expectedPlan,
            option: expectedOption || presetMeta.identityStatus.expectedOption,
            isin: expectedIsin ?? presetMeta.identityStatus.expectedIsin,
            acceptedAliases:
              requestedCode === 119598
                ? ['SBI Bluechip Fund', 'SBI Bluechip Large Cap Fund', 'SBI Large Cap Fund']
                : [],
          },
          providerMeta,
          trustedRegistry
        )
      : validateDiscoveredSchemeIdentity(providerMeta, {
          requestedCode,
          expectedName,
          expectedPlan,
          expectedOption,
          expectedIsin,
          trustedRegistry,
        });

    const validatedPreview = validateRawNavSeries(json?.data, {
      schemeCode: requestedCode,
      provider: 'api.mfapi.in',
      valuationCutoffDate,
      maxStaleDays,
      identity,
      returnedSchemeCode:
        providerMeta && Number.isFinite(providerMeta.scheme_code) ? providerMeta.scheme_code : null,
      returnedSchemeName: providerMeta?.scheme_name || null,
      returnedIsin: providerMeta?.isin_growth || providerMeta?.isin_div_reinvestment || null,
    });

    const accepted = Boolean(identity.verified && validatedPreview.validation.usable);
    const latestPoint = accepted
      ? validatedPreview.points[validatedPreview.points.length - 1]
      : null;

    const failureReason = !identity.verified
      ? identity.reason
      : !validatedPreview.validation.usable
      ? validatedPreview.validation.unavailableReason
      : null;

    return {
      accepted,
      shouldCachePreview: accepted,
      analyticsSuppressed: !accepted,
      scheme_code: requestedCode,
      scheme_name:
        identity.status === 'code_mismatch'
          ? fallbackDisplayName
          : providerMeta?.scheme_name || fallbackDisplayName,
      fund_house: accepted ? providerMeta?.fund_house : undefined,
      scheme_category: accepted ? providerMeta?.scheme_category : undefined,
      scheme_type: accepted ? providerMeta?.scheme_type : undefined,
      isin_growth: identity.providerIsin,
      isin_div_reinvestment: accepted ? providerMeta?.isin_div_reinvestment ?? null : null,
      latestNav: latestPoint ? latestPoint.nav.toFixed(4) : null,
      latestDate: latestPoint ? latestPoint.date : null,
      identity,
      navValidation: validatedPreview.validation,
      previewError: failureReason,
    };
  } catch (err) {
    const netIdentity = validateDiscoveredSchemeIdentity(null, {
      requestedCode,
      expectedName,
      expectedPlan,
      expectedOption,
      expectedIsin,
      trustedRegistry,
    });
    return {
      accepted: false,
      shouldCachePreview: false,
      analyticsSuppressed: true,
      scheme_code: requestedCode,
      scheme_name: fallbackDisplayName,
      latestNav: null,
      latestDate: null,
      identity: netIdentity,
      navValidation: null,
      previewError: err instanceof Error ? err.message : 'Network error loading scheme preview.',
    };
  }
}

/**
 * Shared Add workflow used by App.tsx and regression tests.
 * Validates requestedCode vs returned scheme_code, trusted registry identity, and NAV cutoff/freshness
 * BEFORE committing anything to selectedCodes, customFunds, or validatedSeriesMap.
 */
export async function addSchemeWorkflow(
  options: AddSchemeWorkflowOptions
): Promise<AddSchemeWorkflowResult> {
  const {
    requestedCode,
    expectedName,
    expectedPlan,
    expectedOption,
    expectedIsin,
    selectedCodes,
    customFunds,
    validatedSeriesMap,
    allFunds = { ...PRESET_FUNDS, ...customFunds },
    trustedRegistry = TRUSTED_AMFI_REGISTRY,
    valuationCutoffDate,
    maxStaleDays = 14,
    fetchImpl,
  } = options;

  const unchangedNoCommit = (
    message: string,
    validatedSeries: ValidatedNavSeries | null = null
  ): AddSchemeWorkflowResult => ({
    ok: false,
    message,
    fundMeta: null,
    validatedSeries,
    nextSelectedCodes: selectedCodes,
    nextCustomFunds: customFunds,
    nextValidatedSeriesMap: validatedSeriesMap,
  });

  const rec = PRESET_RECONCILIATION_TABLE[requestedCode];
  if (rec && !rec.selectable) {
    return unchangedNoCommit(rec.reason);
  }

  const knownMeta = allFunds[requestedCode];
  if (knownMeta) {
    if (
      expectedPlan &&
      expectedPlan !== 'Unknown' &&
      knownMeta.plan !== expectedPlan
    ) {
      return unchangedNoCommit(
        `Plan mismatch on code ${requestedCode}: expected ${expectedPlan}, verified registry specifies ${knownMeta.plan}.`
      );
    }
    if (
      expectedOption &&
      expectedOption !== 'Unknown' &&
      knownMeta.option !== expectedOption
    ) {
      return unchangedNoCommit(
        `Option mismatch on code ${requestedCode}: expected ${expectedOption}, verified registry specifies ${knownMeta.option}.`
      );
    }
    if (
      expectedIsin &&
      knownMeta.isin &&
      expectedIsin.trim().toUpperCase() !== knownMeta.isin.trim().toUpperCase()
    ) {
      return unchangedNoCommit(
        `ISIN mismatch on code ${requestedCode}: expected ${expectedIsin.trim().toUpperCase()}, verified registry specifies ${knownMeta.isin}.`
      );
    }

    let series = validatedSeriesMap[requestedCode];
    if (!series) {
      if (fetchImpl) {
        const resp = await fetchImpl(`https://api.mfapi.in/mf/${requestedCode}`);
        if (!resp.ok) {
          return unchangedNoCommit(`Provider returned HTTP ${resp.status} for scheme ${requestedCode}.`);
        }
        const json = await resp.json();
        series = validateMfapiPayload(requestedCode, json, {
          requestedCode,
          expectedName,
          expectedPlan,
          expectedOption,
          expectedIsin,
          expectedMeta: knownMeta,
          trustedRegistry,
          valuationCutoffDate,
          maxStaleDays,
        });
      } else {
        series = await fetchLiveMfNav(requestedCode, {
          requestedCode,
          expectedName,
          expectedPlan,
          expectedOption,
          expectedIsin,
          expectedMeta: knownMeta,
          trustedRegistry,
          valuationCutoffDate,
          maxStaleDays,
        });
      }
    }

    if (!series.identity?.verified) {
      return unchangedNoCommit(
        series.identity?.reason || 'Scheme identity verification failed.',
        series
      );
    }
    if (!series.validation.usable) {
      return unchangedNoCommit(
        series.validation.unavailableReason || 'Scheme NAV validation failed.',
        series
      );
    }

    return {
      ok: true,
      message: `Added verified scheme ${knownMeta.name} (${requestedCode}).`,
      fundMeta: knownMeta,
      validatedSeries: series,
      nextSelectedCodes: selectedCodes.includes(requestedCode)
        ? selectedCodes
        : [...selectedCodes, requestedCode],
      nextCustomFunds: customFunds,
      nextValidatedSeriesMap: validatedSeriesMap[requestedCode]
        ? validatedSeriesMap
        : { ...validatedSeriesMap, [requestedCode]: series },
    };
  }

  try {
    const activeFetch = fetchImpl ?? fetch;
    const resp = await activeFetch(`https://api.mfapi.in/mf/${requestedCode}`);
    if (!resp.ok) {
      return unchangedNoCommit(`Provider returned HTTP ${resp.status} for scheme ${requestedCode}.`);
    }

    const json = (await resp.json()) as {
      meta?: MfapiMeta;
      data?: { date: string; nav: string | number }[];
      status?: string;
    };
    if (!json || !json.meta) {
      return unchangedNoCommit(`Malformed provider response for scheme ${requestedCode}.`);
    }

    const discoveredMeta = classifyAndBuildFundMeta(json.meta, {
      requestedCode,
      expectedName,
      expectedPlan,
      expectedOption,
      expectedIsin,
      trustedRegistry,
    });

    const validated = validateMfapiPayload(requestedCode, json, {
      requestedCode,
      expectedName,
      expectedPlan,
      expectedOption,
      expectedIsin,
      trustedRegistry,
      valuationCutoffDate,
      maxStaleDays,
    });

    if (!validated.identity?.verified) {
      return unchangedNoCommit(
        validated.identity?.reason ||
          `Scheme ${requestedCode} blocked: scheme identity could not be verified against trusted AMFI registry.`,
        validated
      );
    }

    if (!validated.validation.usable) {
      return unchangedNoCommit(
        validated.validation.unavailableReason ||
          `Scheme ${requestedCode} NAV series failed validation (${validated.validation.status}).`,
        validated
      );
    }

    return {
      ok: true,
      message: validated.validation.quarantinedFromBreak
        ? `Added ${discoveredMeta.name} (${requestedCode}) with corporate-action break quarantine notice.`
        : `Added ${discoveredMeta.name} (${requestedCode}) — verified AMFI registry identity & NAV series.`,
      fundMeta: discoveredMeta,
      validatedSeries: validated,
      nextSelectedCodes: selectedCodes.includes(requestedCode)
        ? selectedCodes
        : [...selectedCodes, requestedCode],
      nextCustomFunds: { ...customFunds, [requestedCode]: discoveredMeta },
      nextValidatedSeriesMap: { ...validatedSeriesMap, [requestedCode]: validated },
    };
  } catch (err) {
    return unchangedNoCommit(
      err instanceof Error ? err.message : `Network error adding scheme ${requestedCode}.`
    );
  }
}
