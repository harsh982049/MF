import {
  IdentityStatus,
  OptionType,
  PlanType,
  PresetReconciliationRecord,
  SchemeIdentityAudit,
} from '../types/quant';

export interface ProviderSchemeMeta {
  scheme_code: number;
  scheme_name: string;
  isin_growth?: string | null;
  isin_div_reinvestment?: string | null;
  fund_house?: string;
  scheme_category?: string;
  scheme_type?: string;
}

export interface ExpectedSchemeIdentity {
  scheme_code: number;
  name: string;
  plan: PlanType;
  option: OptionType;
  isin: string | null;
  acceptedAliases?: string[];
}

export interface TrustedRegistryEntry {
  scheme_code: number;
  scheme_name: string;
  plan: PlanType;
  option: OptionType;
  isin: string;
  asOfDate: string;
  source: string;
  acceptedAliases?: string[];
}

export interface DiscoveryValidationOptions {
  requestedCode?: number;
  expectedName?: string;
  expectedPlan?: PlanType;
  expectedOption?: OptionType;
  expectedIsin?: string | null;
  trustedRegistry?: Record<number, TrustedRegistryEntry>;
}

export const AMFI_SNAPSHOT_DATE = '2026-11-13';
export const AMFI_SNAPSHOT_SOURCE = 'https://www.amfiindia.com/spages/NAVAll.txt';

/**
 * Independent trusted dated AMFI registry snapshot (13 Nov 2026) used to verify scheme identities
 * independently of third-party mfapi.in search/series responses.
 */
export const TRUSTED_AMFI_REGISTRY: Record<number, TrustedRegistryEntry> = {
  122639: {
    scheme_code: 122639,
    scheme_name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    plan: 'Direct',
    option: 'Growth',
    isin: 'INF879O01027',
    asOfDate: AMFI_SNAPSHOT_DATE,
    source: AMFI_SNAPSHOT_SOURCE,
    acceptedAliases: ['Parag Parikh Flexi Cap Fund'],
  },
  127042: {
    scheme_code: 127042,
    scheme_name: 'Motilal Oswal Midcap Fund',
    plan: 'Direct',
    option: 'Growth',
    isin: 'INF247L01445',
    asOfDate: AMFI_SNAPSHOT_DATE,
    source: AMFI_SNAPSHOT_SOURCE,
    acceptedAliases: ['Motilal Oswal Midcap Fund - Direct Plan - Growth'],
  },
  118778: {
    scheme_code: 118778,
    scheme_name: 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    plan: 'Direct',
    option: 'Growth',
    isin: 'INF204K01K15',
    asOfDate: AMFI_SNAPSHOT_DATE,
    source: AMFI_SNAPSHOT_SOURCE,
    acceptedAliases: ['Nippon India Small Cap Fund'],
  },
  119598: {
    scheme_code: 119598,
    scheme_name: 'SBI Large Cap Fund - Direct Plan - Growth',
    plan: 'Direct',
    option: 'Growth',
    isin: 'INF200K01QX4',
    asOfDate: AMFI_SNAPSHOT_DATE,
    source: AMFI_SNAPSHOT_SOURCE,
    acceptedAliases: ['SBI Bluechip Fund', 'SBI Bluechip Large Cap Fund', 'SBI Large Cap Fund'],
  },
  113049: {
    scheme_code: 113049,
    scheme_name: 'HDFC Gold ETF - Growth Option',
    plan: 'ETF',
    option: 'Growth',
    isin: 'INF179KC1981',
    asOfDate: AMFI_SNAPSHOT_DATE,
    source: 'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?mf=9',
    acceptedAliases: ['HDFC Gold ETF', 'HDFC Gold Exchange Traded Fund'],
  },
};

/**
 * Nine-preset reconciliation against the audited 13 November 2026 AMFI snapshot (Table A).
 * Preserves all 9 preset IDs for transparent audit review while blocking mismatched or unverified presets.
 */
export const PRESET_RECONCILIATION_TABLE: Record<number, PresetReconciliationRecord> = {
  122639: {
    scheme_code: 122639,
    auditedPresetName: 'Parag Parikh Flexi Cap Fund',
    auditedPresetIsin: 'INF879O01027',
    amfiName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    amfiIsin: 'INF879O01027',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth',
    amfiNav: 94.2594,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'verified',
    selectable: true,
    reason: 'Exact AMFI code, name, Direct Plan, Growth option, and ISIN match.',
  },
  127042: {
    scheme_code: 127042,
    auditedPresetName: 'Motilal Oswal Midcap Fund',
    auditedPresetIsin: 'INF247L01646',
    amfiName: 'Motilal Oswal Midcap Fund',
    amfiIsin: 'INF247L01445',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth',
    amfiNav: 123.0732,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'reconciled_isin',
    selectable: true,
    reason:
      'Preset ISIN INF247L01646 reconciled to AMFI INF247L01445. Official AMFI historical row confirms Direct Plan Growth.',
  },
  118989: {
    scheme_code: 118989,
    auditedPresetName: 'HDFC Top 100 Large Cap Fund',
    auditedPresetIsin: 'INF179K01BE2',
    amfiName: 'HDFC Mid Cap Fund - Direct Plan - Growth Option',
    amfiIsin: 'INF179K01XQ0',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth Option',
    amfiNav: 229.697,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'unavailable_mismatch',
    selectable: false,
    reason:
      'Cross-scheme mismatch: audited preset claims HDFC Top 100 Large Cap Fund (INF179K01BE2), but scheme code 118989 identifies HDFC Mid Cap Fund (INF179K01XQ0). Blocked until resolved.',
  },
  118778: {
    scheme_code: 118778,
    auditedPresetName: 'Nippon India Small Cap Fund',
    auditedPresetIsin: 'INF204K01726',
    amfiName: 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    amfiIsin: 'INF204K01K15',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth Option',
    amfiNav: 204.2367,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'reconciled_isin',
    selectable: true,
    reason:
      'Preset ISIN INF204K01726 reconciled to AMFI INF204K01K15 (Nippon India Small Cap Fund - Direct Plan - Growth Option).',
  },
  119598: {
    scheme_code: 119598,
    auditedPresetName: 'SBI Bluechip Large Cap Fund',
    auditedPresetIsin: 'INF200K01135',
    amfiName: 'SBI Large Cap Fund - Direct Plan - Growth',
    amfiIsin: 'INF200K01QX4',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth',
    amfiNav: 107.5881,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'reconciled_isin',
    selectable: true,
    reason:
      'Scheme renamed from SBI Bluechip Fund to SBI Large Cap Fund; preset ISIN INF200K01135 reconciled to AMFI INF200K01QX4.',
  },
  120503: {
    scheme_code: 120503,
    auditedPresetName: 'ICICI Prudential Corporate Bond Fund',
    auditedPresetIsin: 'INF109K01AQ5',
    amfiName: 'Axis ELSS- Tax Saver Fund - Direct Plan - Growth Option',
    amfiIsin: 'INF846K01EW2',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth Option',
    amfiNav: 116.1262,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'unavailable_mismatch',
    selectable: false,
    reason:
      'Cross-scheme mismatch: audited preset claims ICICI Prudential Corporate Bond Fund (INF109K01AQ5), but scheme code 120503 identifies Axis ELSS- Tax Saver Fund (INF846K01EW2). Blocked until resolved.',
  },
  120586: {
    scheme_code: 120586,
    auditedPresetName: 'ICICI Prudential Balanced Advantage Fund',
    auditedPresetIsin: 'INF109K01844',
    amfiName: 'ICICI Prudential Large Cap Fund (erstwhile Bluechip Fund) - Direct Plan - Growth',
    amfiIsin: 'INF109K016L0',
    amfiPlan: 'Direct Plan',
    amfiOption: 'Growth',
    amfiNav: 123.25,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'unavailable_mismatch',
    selectable: false,
    reason:
      'Cross-scheme mismatch: audited preset claims ICICI Prudential Balanced Advantage Fund (INF109K01844), but scheme code 120586 identifies ICICI Prudential Large Cap Fund (INF109K016L0). Blocked until resolved.',
  },
  118753: {
    scheme_code: 118753,
    auditedPresetName: 'Nippon India Gold Savings Fund',
    auditedPresetIsin: 'INF204K01585',
    amfiName: null,
    amfiIsin: null,
    amfiPlan: null,
    amfiOption: null,
    amfiNav: null,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'unavailable_missing',
    selectable: false,
    reason:
      'Missing from 13-Nov-2026 AMFI snapshot; provider resolves scheme code 118753 to stale 2013 Reliance Natural Resources Fund with null ISIN instead of Nippon India Gold Savings Fund.',
  },
  145552: {
    scheme_code: 145552,
    auditedPresetName: 'Motilal Oswal Nasdaq 100 FoF',
    auditedPresetIsin: 'INF247L01786',
    amfiName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    amfiIsin: 'INF247L01718',
    amfiPlan: null,
    amfiOption: null,
    amfiNav: 63.7597,
    amfiDate: AMFI_SNAPSHOT_DATE,
    resolutionStatus: 'unavailable_unverified_plan',
    selectable: false,
    reason:
      'Plan and option omitted in AMFI latest snapshot & MFAPI (no independent historical Direct/Growth confirmation) and preset ISIN INF247L01786 mismatches INF247L01718. Unavailable until plan/option independently verified.',
  },
};

export function isValidIsin(isin: string | null | undefined): boolean {
  if (!isin || typeof isin !== 'string') return false;
  const cleaned = isin.trim().toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(cleaned);
}

export function parsePlanAndOption(schemeName: string): { plan: PlanType; option: OptionType } {
  const s = (schemeName || '').toLowerCase();

  let plan: PlanType = 'Unknown';
  if (/\bdirect\b/.test(s)) {
    plan = 'Direct';
  } else if (/\bregular\b/.test(s)) {
    plan = 'Regular';
  } else if (/\betf\b/.test(s)) {
    plan = 'ETF';
  }

  let option: OptionType = 'Unknown';
  if (/\bgrowth\b/.test(s)) {
    option = 'Growth';
  } else if (/\bidcw\b|\bdividend\b|\bpayout\b|\breinvestment\b/.test(s)) {
    option = 'IDCW';
  }

  return { plan, option };
}

export function normalizeBaseSchemeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\(erstwhile[^)]*\)/g, ' ')
    .replace(/\(formerly[^)]*\)/g, ' ')
    .replace(/\bfund of fund\b/g, 'fof')
    .replace(/\bdirect\s*plan\b/g, ' ')
    .replace(/\bregular\s*plan\b/g, ' ')
    .replace(/\bdirect\b/g, ' ')
    .replace(/\bregular\b/g, ' ')
    .replace(/\bgrowth\s*option\b/g, ' ')
    .replace(/\bgrowth\s*plan\b/g, ' ')
    .replace(/\bgrowth\b/g, ' ')
    .replace(/\bidcw\b/g, ' ')
    .replace(/\bdividend\b/g, ' ')
    .replace(/\bplan\b/g, ' ')
    .replace(/\boption\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areSchemeNamesCompatible(
  expectedName: string,
  providerName: string,
  acceptedAliases: string[] = []
): boolean {
  const candidates = [expectedName, ...acceptedAliases].map(normalizeBaseSchemeName).filter(Boolean);
  const prov = normalizeBaseSchemeName(providerName);
  if (!prov || candidates.length === 0) return false;

  return candidates.some((cand) => {
    if (cand === prov) return true;
    const candTokens = cand.split(' ').filter((t) => t !== 'fund' && t !== 'mutual');
    const provTokens = new Set(prov.split(' ').filter((t) => t !== 'fund' && t !== 'mutual'));
    if (candTokens.length === 0 || provTokens.size === 0) return false;
    const overlap = candTokens.filter((t) => provTokens.has(t)).length;
    return overlap === candTokens.length && Math.abs(candTokens.length - provTokens.size) <= 2;
  });
}

function registryContextForCode(
  schemeCode: number,
  expected: ExpectedSchemeIdentity,
  trustedRegistry: Record<number, TrustedRegistryEntry>
) {
  const regEntry = trustedRegistry[schemeCode];
  const presetRec = PRESET_RECONCILIATION_TABLE[schemeCode];
  if (regEntry) {
    return {
      registrySchemeCode: regEntry.scheme_code,
      registryName: regEntry.scheme_name,
      registryPlan: regEntry.plan,
      registryOption: regEntry.option,
      registryIsin: regEntry.isin,
      registryAsOfDate: regEntry.asOfDate,
    };
  }
  if (presetRec) {
    return {
      registrySchemeCode: presetRec.scheme_code,
      registryName: presetRec.amfiName ?? presetRec.auditedPresetName,
      registryPlan: presetRec.amfiPlan?.toLowerCase().includes('direct') ? ('Direct' as PlanType) : ('Unknown' as PlanType),
      registryOption: presetRec.amfiOption?.toLowerCase().includes('growth') ? ('Growth' as OptionType) : ('Unknown' as OptionType),
      registryIsin: presetRec.amfiIsin,
      registryAsOfDate: presetRec.amfiDate,
    };
  }
  return {
    registrySchemeCode: null,
    registryName: expected.name,
    registryPlan: expected.plan,
    registryOption: expected.option,
    registryIsin: expected.isin,
    registryAsOfDate: null,
  };
}

export function validateSchemeIdentity(
  expected: ExpectedSchemeIdentity,
  provider: ProviderSchemeMeta | null,
  trustedRegistry: Record<number, TrustedRegistryEntry> = TRUSTED_AMFI_REGISTRY
): SchemeIdentityAudit {
  const rec = PRESET_RECONCILIATION_TABLE[expected.scheme_code];
  const regCtx = registryContextForCode(expected.scheme_code, expected, trustedRegistry);

  // Check code mismatch BEFORE trusting any other fetched field
  const rawProvCode = provider?.scheme_code != null ? Number(provider.scheme_code) : null;
  if (provider && (rawProvCode === null || !Number.isFinite(rawProvCode) || rawProvCode !== expected.scheme_code)) {
    const parsed = parsePlanAndOption(provider.scheme_name);
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'code_mismatch',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: rawProvCode,
      providerName: provider.scheme_name || null,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin: provider.isin_growth ? provider.isin_growth.trim().toUpperCase() : null,
      providerSource: 'mfapi',
      reason: `Scheme code mismatch: expected ${expected.scheme_code} (${expected.name}), fetched payload returned scheme ${provider.scheme_code} (${provider.scheme_name || 'Unknown'}).`,
    };
  }

  if (rec && !rec.selectable) {
    const blockedStatus: IdentityStatus =
      rec.resolutionStatus === 'unavailable_missing'
        ? 'missing_from_registry'
        : rec.resolutionStatus === 'unavailable_unverified_plan'
        ? 'plan_unverified'
        : 'cross_scheme_mismatch';

    const parsedProvider = provider
      ? parsePlanAndOption(provider.scheme_name)
      : { plan: 'Unknown' as PlanType, option: 'Unknown' as OptionType };

    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: blockedStatus,
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: rawProvCode,
      providerName: provider?.scheme_name || rec.amfiName || null,
      providerPlan: parsedProvider.plan,
      providerOption: parsedProvider.option,
      providerIsin: provider?.isin_growth || rec.amfiIsin || null,
      providerSource: provider ? 'mfapi' : 'amfi_registry',
      reason: rec.reason,
    };
  }

  const regEntry = trustedRegistry[expected.scheme_code];
  if (regEntry) {
    const parsedForReg = provider
      ? parsePlanAndOption(provider.scheme_name)
      : { plan: 'Unknown' as PlanType, option: 'Unknown' as OptionType };
    const provIsinForReg = provider?.isin_growth
      ? provider.isin_growth.trim().toUpperCase()
      : null;

    if (expected.plan !== 'Unknown' && expected.plan !== regEntry.plan) {
      return {
        scheme_code: expected.scheme_code,
        verified: false,
        status: 'plan_mismatch',
        expectedName: expected.name,
        expectedPlan: expected.plan,
        expectedOption: expected.option,
        expectedIsin: expected.isin,
        ...regCtx,
        registryMatched: false,
        providerSchemeCode: rawProvCode,
        providerName: provider?.scheme_name || null,
        providerPlan: parsedForReg.plan,
        providerOption: parsedForReg.option,
        providerIsin: provIsinForReg,
        providerSource: provider ? 'mfapi' : 'unavailable',
        reason: `Plan mismatch on code ${expected.scheme_code}: expected ${expected.plan}, AMFI registry specifies ${regEntry.plan}.`,
      };
    }

    if (expected.option !== 'Unknown' && expected.option !== regEntry.option) {
      return {
        scheme_code: expected.scheme_code,
        verified: false,
        status: 'plan_mismatch',
        expectedName: expected.name,
        expectedPlan: expected.plan,
        expectedOption: expected.option,
        expectedIsin: expected.isin,
        ...regCtx,
        registryMatched: false,
        providerSchemeCode: rawProvCode,
        providerName: provider?.scheme_name || null,
        providerPlan: parsedForReg.plan,
        providerOption: parsedForReg.option,
        providerIsin: provIsinForReg,
        providerSource: provider ? 'mfapi' : 'unavailable',
        reason: `Option mismatch on code ${expected.scheme_code}: expected ${expected.option}, AMFI registry specifies ${regEntry.option}.`,
      };
    }

    if (expected.isin && expected.isin.trim().toUpperCase() !== regEntry.isin.trim().toUpperCase()) {
      return {
        scheme_code: expected.scheme_code,
        verified: false,
        status: 'isin_mismatch',
        expectedName: expected.name,
        expectedPlan: expected.plan,
        expectedOption: expected.option,
        expectedIsin: expected.isin,
        ...regCtx,
        registryMatched: false,
        providerSchemeCode: rawProvCode,
        providerName: provider?.scheme_name || null,
        providerPlan: parsedForReg.plan,
        providerOption: parsedForReg.option,
        providerIsin: provIsinForReg,
        providerSource: provider ? 'mfapi' : 'unavailable',
        reason: `ISIN mismatch on code ${expected.scheme_code}: expected ${expected.isin.trim().toUpperCase()}, AMFI registry specifies ${regEntry.isin}.`,
      };
    }
  }

  if (!provider) {
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'provider_error',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: null,
      providerName: null,
      providerPlan: 'Unknown',
      providerOption: 'Unknown',
      providerIsin: null,
      providerSource: 'unavailable',
      reason: `Provider metadata unavailable for scheme code ${expected.scheme_code}.`,
    };
  }

  const parsed = parsePlanAndOption(provider.scheme_name);
  const providerIsinRaw =
    expected.option === 'IDCW'
      ? provider.isin_div_reinvestment || provider.isin_growth || null
      : provider.isin_growth || null;
  const providerIsin = providerIsinRaw ? providerIsinRaw.trim().toUpperCase() : null;

  if (!areSchemeNamesCompatible(expected.name, provider.scheme_name, expected.acceptedAliases)) {
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'cross_scheme_mismatch',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: rawProvCode,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      reason: `Scheme name mismatch on code ${expected.scheme_code}: expected "${expected.name}", provider returned "${provider.scheme_name}".`,
    };
  }

  // Table A special note: code 127042 omits plan/option on MFAPI/AMFI latest row,
  // but is independently confirmed Direct Plan Growth via official AMFI historical record.
  const confirmedViaAmfiHistory127042 =
    expected.scheme_code === 127042 &&
    parsed.plan === 'Unknown' &&
    parsed.option === 'Unknown' &&
    providerIsin === 'INF247L01445';

  const effectiveProviderPlan: PlanType = confirmedViaAmfiHistory127042 ? 'Direct' : parsed.plan;
  const effectiveProviderOption: OptionType = confirmedViaAmfiHistory127042 ? 'Growth' : parsed.option;

  if (!confirmedViaAmfiHistory127042) {
    if (expected.plan !== 'Unknown') {
      if (parsed.plan === 'Unknown') {
        return {
          scheme_code: expected.scheme_code,
          verified: false,
          status: 'plan_unverified',
          expectedName: expected.name,
          expectedPlan: expected.plan,
          expectedOption: expected.option,
          expectedIsin: expected.isin,
          ...regCtx,
          registryMatched: false,
          providerSchemeCode: rawProvCode,
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          reason: `Plan label omitted in provider name "${provider.scheme_name}". Independent verification of ${expected.plan} Plan required.`,
        };
      }
      if (parsed.plan !== expected.plan) {
        return {
          scheme_code: expected.scheme_code,
          verified: false,
          status: 'plan_mismatch',
          expectedName: expected.name,
          expectedPlan: expected.plan,
          expectedOption: expected.option,
          expectedIsin: expected.isin,
          ...regCtx,
          registryMatched: false,
          providerSchemeCode: rawProvCode,
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          reason: `Plan mismatch on code ${expected.scheme_code}: expected ${expected.plan}, provider returned ${parsed.plan}.`,
        };
      }
    }

    if (expected.option !== 'Unknown') {
      if (parsed.option === 'Unknown') {
        return {
          scheme_code: expected.scheme_code,
          verified: false,
          status: 'plan_unverified',
          expectedName: expected.name,
          expectedPlan: expected.plan,
          expectedOption: expected.option,
          expectedIsin: expected.isin,
          ...regCtx,
          registryMatched: false,
          providerSchemeCode: rawProvCode,
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          reason: `Option label omitted in provider name "${provider.scheme_name}". Independent verification of ${expected.option} option required.`,
        };
      }
      if (parsed.option !== expected.option) {
        return {
          scheme_code: expected.scheme_code,
          verified: false,
          status: 'plan_mismatch',
          expectedName: expected.name,
          expectedPlan: expected.plan,
          expectedOption: expected.option,
          expectedIsin: expected.isin,
          ...regCtx,
          registryMatched: false,
          providerSchemeCode: rawProvCode,
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          reason: `Option mismatch on code ${expected.scheme_code}: expected ${expected.option}, provider returned ${parsed.option}.`,
        };
      }
    }
  }

  if (!isValidIsin(providerIsin)) {
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'unresolved_isin',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: rawProvCode,
      providerName: provider.scheme_name,
      providerPlan: effectiveProviderPlan,
      providerOption: effectiveProviderOption,
      providerIsin,
      providerSource: 'mfapi',
      reason: `Unresolved or invalid ISIN "${providerIsin ?? 'null'}" for scheme code ${expected.scheme_code}.`,
    };
  }

  if (expected.isin && expected.isin.trim().toUpperCase() !== providerIsin) {
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'isin_mismatch',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      ...regCtx,
      registryMatched: false,
      providerSchemeCode: rawProvCode,
      providerName: provider.scheme_name,
      providerPlan: effectiveProviderPlan,
      providerOption: effectiveProviderOption,
      providerIsin,
      providerSource: 'mfapi',
      reason: `ISIN mismatch on code ${expected.scheme_code}: expected ${expected.isin}, fetched provider returned ${providerIsin}.`,
    };
  }

  const finalStatus: IdentityStatus =
    rec?.resolutionStatus === 'reconciled_isin' ? 'reconciled_isin' : 'verified';

  return {
    scheme_code: expected.scheme_code,
    verified: true,
    status: finalStatus,
    expectedName: expected.name,
    expectedPlan: expected.plan,
    expectedOption: expected.option,
    expectedIsin: expected.isin,
    ...regCtx,
    registryMatched: Boolean(trustedRegistry[expected.scheme_code]),
    providerSchemeCode: rawProvCode,
    providerName: provider.scheme_name,
    providerPlan: effectiveProviderPlan,
    providerOption: effectiveProviderOption,
    providerIsin,
    providerSource: 'mfapi',
    reason: rec?.reason || 'Verified scheme code, name, plan, option, and ISIN against trusted AMFI registry and mfapi.in.',
  };
}

/**
 * Validates a discovered scheme (from search/browse/manual code) against an independently expected code,
 * optional expected metadata, AND a trusted dated AMFI registry snapshot.
 * If independent registry evidence is unavailable, labels the scheme as `unverified_registry` with verified=false.
 */
export function validateDiscoveredSchemeIdentity(
  provider: ProviderSchemeMeta | null,
  options: DiscoveryValidationOptions = {}
): SchemeIdentityAudit {
  const requestedCode = options.requestedCode ?? (provider?.scheme_code || 0);
  const trustedRegistry = options.trustedRegistry ?? TRUSTED_AMFI_REGISTRY;
  const regEntry = requestedCode ? trustedRegistry[requestedCode] : undefined;

  if (!provider || !provider.scheme_code || !provider.scheme_name) {
    return {
      scheme_code: requestedCode,
      verified: false,
      status: 'provider_error',
      expectedName: options.expectedName || regEntry?.scheme_name || 'Unknown Scheme',
      expectedPlan: options.expectedPlan || regEntry?.plan || 'Unknown',
      expectedOption: options.expectedOption || regEntry?.option || 'Unknown',
      expectedIsin: options.expectedIsin ?? regEntry?.isin ?? null,
      registrySchemeCode: regEntry?.scheme_code ?? null,
      registryName: regEntry?.scheme_name ?? null,
      registryPlan: regEntry?.plan ?? 'Unknown',
      registryOption: regEntry?.option ?? 'Unknown',
      registryIsin: regEntry?.isin ?? null,
      registryMatched: false,
      providerSchemeCode: provider?.scheme_code != null ? Number(provider.scheme_code) : null,
      providerName: provider?.scheme_name || null,
      providerPlan: 'Unknown',
      providerOption: 'Unknown',
      providerIsin: null,
      providerSource: 'unavailable',
      registryAsOfDate: regEntry?.asOfDate ?? null,
      reason: 'Incomplete scheme metadata returned by mfapi.in.',
    };
  }

  const returnedCode = Number(provider.scheme_code);
  if (options.requestedCode !== undefined && returnedCode !== options.requestedCode) {
    const parsedProv = parsePlanAndOption(provider.scheme_name);
    const provIsin = (provider.isin_growth || provider.isin_div_reinvestment || null)?.trim().toUpperCase() || null;
    return {
      scheme_code: options.requestedCode,
      verified: false,
      status: 'code_mismatch',
      expectedName: options.expectedName || regEntry?.scheme_name || `Requested Scheme ${options.requestedCode}`,
      expectedPlan: options.expectedPlan || regEntry?.plan || 'Unknown',
      expectedOption: options.expectedOption || regEntry?.option || 'Unknown',
      expectedIsin: options.expectedIsin ?? regEntry?.isin ?? null,
      registrySchemeCode: regEntry?.scheme_code ?? null,
      registryName: regEntry?.scheme_name ?? null,
      registryPlan: regEntry?.plan ?? 'Unknown',
      registryOption: regEntry?.option ?? 'Unknown',
      registryIsin: regEntry?.isin ?? null,
      registryMatched: false,
      providerSchemeCode: Number.isFinite(returnedCode) ? returnedCode : null,
      providerName: provider.scheme_name,
      providerPlan: parsedProv.plan,
      providerOption: parsedProv.option,
      providerIsin: provIsin,
      providerSource: 'mfapi',
      registryAsOfDate: regEntry?.asOfDate ?? null,
      reason: `Scheme code mismatch: requested code ${options.requestedCode}, but provider returned code ${provider.scheme_code} (${provider.scheme_name}).`,
    };
  }

  const targetCode = options.requestedCode ?? returnedCode;
  const rec = PRESET_RECONCILIATION_TABLE[targetCode];
  if (rec) {
    return validateSchemeIdentity(
      {
        scheme_code: rec.scheme_code,
        name: rec.auditedPresetName,
        plan: rec.amfiPlan?.toLowerCase().includes('direct') ? 'Direct' : 'Unknown',
        option: rec.amfiOption?.toLowerCase().includes('growth') ? 'Growth' : 'Unknown',
        isin: rec.amfiIsin,
        acceptedAliases: rec.amfiName ? [rec.amfiName] : [],
      },
      provider,
      trustedRegistry
    );
  }

  // If the independent trusted dated registry has an entry for targetCode, validate BOTH caller expectations AND provider strictly against it
  if (regEntry) {
    if (
      options.expectedPlan &&
      options.expectedPlan !== 'Unknown' &&
      options.expectedPlan !== regEntry.plan
    ) {
      const parsedProv = parsePlanAndOption(provider.scheme_name);
      const provIsin = (provider.isin_growth || provider.isin_div_reinvestment || null)?.trim().toUpperCase() || null;
      return {
        scheme_code: targetCode,
        verified: false,
        status: 'plan_mismatch',
        expectedName: options.expectedName || regEntry.scheme_name,
        expectedPlan: options.expectedPlan,
        expectedOption: options.expectedOption || regEntry.option,
        expectedIsin: options.expectedIsin ?? regEntry.isin,
        registrySchemeCode: regEntry.scheme_code,
        registryName: regEntry.scheme_name,
        registryPlan: regEntry.plan,
        registryOption: regEntry.option,
        registryIsin: regEntry.isin,
        registryMatched: false,
        providerSchemeCode: returnedCode,
        providerName: provider.scheme_name,
        providerPlan: parsedProv.plan,
        providerOption: parsedProv.option,
        providerIsin: provIsin,
        providerSource: 'mfapi',
        registryAsOfDate: regEntry.asOfDate,
        reason: `Plan mismatch on code ${targetCode}: expected ${options.expectedPlan}, AMFI registry specifies ${regEntry.plan}.`,
      };
    }

    if (
      options.expectedOption &&
      options.expectedOption !== 'Unknown' &&
      options.expectedOption !== regEntry.option
    ) {
      const parsedProv = parsePlanAndOption(provider.scheme_name);
      const provIsin = (provider.isin_growth || provider.isin_div_reinvestment || null)?.trim().toUpperCase() || null;
      return {
        scheme_code: targetCode,
        verified: false,
        status: 'plan_mismatch',
        expectedName: options.expectedName || regEntry.scheme_name,
        expectedPlan: options.expectedPlan || regEntry.plan,
        expectedOption: options.expectedOption,
        expectedIsin: options.expectedIsin ?? regEntry.isin,
        registrySchemeCode: regEntry.scheme_code,
        registryName: regEntry.scheme_name,
        registryPlan: regEntry.plan,
        registryOption: regEntry.option,
        registryIsin: regEntry.isin,
        registryMatched: false,
        providerSchemeCode: returnedCode,
        providerName: provider.scheme_name,
        providerPlan: parsedProv.plan,
        providerOption: parsedProv.option,
        providerIsin: provIsin,
        providerSource: 'mfapi',
        registryAsOfDate: regEntry.asOfDate,
        reason: `Option mismatch on code ${targetCode}: expected ${options.expectedOption}, AMFI registry specifies ${regEntry.option}.`,
      };
    }

    if (
      options.expectedIsin &&
      isValidIsin(options.expectedIsin) &&
      options.expectedIsin.trim().toUpperCase() !== regEntry.isin.trim().toUpperCase()
    ) {
      const parsedProv = parsePlanAndOption(provider.scheme_name);
      const provIsin = (provider.isin_growth || provider.isin_div_reinvestment || null)?.trim().toUpperCase() || null;
      return {
        scheme_code: targetCode,
        verified: false,
        status: 'isin_mismatch',
        expectedName: options.expectedName || regEntry.scheme_name,
        expectedPlan: options.expectedPlan || regEntry.plan,
        expectedOption: options.expectedOption || regEntry.option,
        expectedIsin: options.expectedIsin.trim().toUpperCase(),
        registrySchemeCode: regEntry.scheme_code,
        registryName: regEntry.scheme_name,
        registryPlan: regEntry.plan,
        registryOption: regEntry.option,
        registryIsin: regEntry.isin,
        registryMatched: false,
        providerSchemeCode: returnedCode,
        providerName: provider.scheme_name,
        providerPlan: parsedProv.plan,
        providerOption: parsedProv.option,
        providerIsin: provIsin,
        providerSource: 'mfapi',
        registryAsOfDate: regEntry.asOfDate,
        reason: `ISIN mismatch on code ${targetCode}: expected ${options.expectedIsin.trim().toUpperCase()}, AMFI registry specifies ${regEntry.isin}.`,
      };
    }

    return validateSchemeIdentity(
      {
        scheme_code: regEntry.scheme_code,
        name: options.expectedName || regEntry.scheme_name,
        plan: regEntry.plan,
        option: regEntry.option,
        isin: regEntry.isin,
        acceptedAliases: [regEntry.scheme_name, ...(regEntry.acceptedAliases || [])],
      },
      provider,
      trustedRegistry
    );
  }

  // No trusted independent registry record exists: check basic structural integrity, then mark unverified_registry
  const parsed = parsePlanAndOption(provider.scheme_name);
  const rawIsin =
    parsed.option === 'IDCW'
      ? provider.isin_div_reinvestment || provider.isin_growth || null
      : provider.isin_growth || null;
  const providerIsin = rawIsin ? rawIsin.trim().toUpperCase() : null;

  if (options.expectedPlan && options.expectedPlan !== 'Unknown' && parsed.plan !== 'Unknown' && parsed.plan !== options.expectedPlan) {
    return {
      scheme_code: targetCode,
      verified: false,
      status: 'plan_mismatch',
      expectedName: options.expectedName || provider.scheme_name,
      expectedPlan: options.expectedPlan,
      expectedOption: options.expectedOption || parsed.option,
      expectedIsin: options.expectedIsin ?? null,
      registrySchemeCode: null,
      registryName: null,
      registryPlan: 'Unknown',
      registryOption: 'Unknown',
      registryIsin: null,
      registryMatched: false,
      providerSchemeCode: returnedCode,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: null,
      reason: `Plan mismatch on code ${targetCode}: expected ${options.expectedPlan}, provider returned ${parsed.plan}.`,
    };
  }

  if (parsed.plan === 'Unknown' || parsed.option === 'Unknown') {
    return {
      scheme_code: targetCode,
      verified: false,
      status: 'plan_unverified',
      expectedName: options.expectedName || provider.scheme_name,
      expectedPlan: options.expectedPlan || parsed.plan,
      expectedOption: options.expectedOption || parsed.option,
      expectedIsin: options.expectedIsin ?? providerIsin,
      registrySchemeCode: null,
      registryName: null,
      registryPlan: 'Unknown',
      registryOption: 'Unknown',
      registryIsin: null,
      registryMatched: false,
      providerSchemeCode: returnedCode,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: null,
      reason: `Plan (${parsed.plan}) or option (${parsed.option}) could not be verified from scheme name "${provider.scheme_name}".`,
    };
  }

  if (!isValidIsin(providerIsin)) {
    return {
      scheme_code: targetCode,
      verified: false,
      status: 'unresolved_isin',
      expectedName: options.expectedName || provider.scheme_name,
      expectedPlan: options.expectedPlan || parsed.plan,
      expectedOption: options.expectedOption || parsed.option,
      expectedIsin: options.expectedIsin ?? null,
      registrySchemeCode: null,
      registryName: null,
      registryPlan: 'Unknown',
      registryOption: 'Unknown',
      registryIsin: null,
      registryMatched: false,
      providerSchemeCode: returnedCode,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: null,
      reason: `Missing or invalid effective ISIN for scheme ${targetCode}.`,
    };
  }

  if (
    options.expectedIsin &&
    isValidIsin(options.expectedIsin) &&
    options.expectedIsin.trim().toUpperCase() !== providerIsin
  ) {
    return {
      scheme_code: targetCode,
      verified: false,
      status: 'isin_mismatch',
      expectedName: options.expectedName || provider.scheme_name,
      expectedPlan: options.expectedPlan || parsed.plan,
      expectedOption: options.expectedOption || parsed.option,
      expectedIsin: options.expectedIsin.trim().toUpperCase(),
      registrySchemeCode: null,
      registryName: null,
      registryPlan: 'Unknown',
      registryOption: 'Unknown',
      registryIsin: null,
      registryMatched: false,
      providerSchemeCode: returnedCode,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: null,
      reason: `ISIN mismatch on code ${targetCode}: expected ${options.expectedIsin.trim().toUpperCase()}, provider returned ${providerIsin}.`,
    };
  }

  return {
    scheme_code: targetCode,
    verified: false,
    status: 'unverified_registry',
    expectedName: options.expectedName || provider.scheme_name,
    expectedPlan: options.expectedPlan || parsed.plan,
    expectedOption: options.expectedOption || parsed.option,
    expectedIsin: options.expectedIsin ?? providerIsin,
    registrySchemeCode: null,
    registryName: null,
    registryPlan: 'Unknown',
    registryOption: 'Unknown',
    registryIsin: null,
    registryMatched: false,
    providerSchemeCode: returnedCode,
    providerName: provider.scheme_name,
    providerPlan: parsed.plan,
    providerOption: parsed.option,
    providerIsin,
    providerSource: 'mfapi',
    registryAsOfDate: null,
    reason: `Unverified discovery: scheme ${targetCode} (${provider.scheme_name}, ISIN ${providerIsin}) has no matching record in the trusted dated AMFI registry (${AMFI_SNAPSHOT_DATE}); research analytics are suppressed.`,
  };
}
