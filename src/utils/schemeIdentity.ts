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

export const AMFI_SNAPSHOT_DATE = '2026-11-13';
export const AMFI_SNAPSHOT_SOURCE = 'https://www.amfiindia.com/spages/NAVAll.txt';

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

export function validateSchemeIdentity(
  expected: ExpectedSchemeIdentity,
  provider: ProviderSchemeMeta | null
): SchemeIdentityAudit {
  const rec = PRESET_RECONCILIATION_TABLE[expected.scheme_code];

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
      providerName: provider?.scheme_name || rec.amfiName || null,
      providerPlan: parsedProvider.plan,
      providerOption: parsedProvider.option,
      providerIsin: provider?.isin_growth || rec.amfiIsin || null,
      providerSource: provider ? 'mfapi' : 'amfi_registry',
      registryAsOfDate: rec.amfiDate,
      reason: rec.reason,
    };
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
      providerName: null,
      providerPlan: 'Unknown',
      providerOption: 'Unknown',
      providerIsin: null,
      providerSource: 'unavailable',
      registryAsOfDate: rec?.amfiDate || null,
      reason: `Provider metadata unavailable for scheme code ${expected.scheme_code}.`,
    };
  }

  if (Number(provider.scheme_code) !== expected.scheme_code) {
    const parsed = parsePlanAndOption(provider.scheme_name);
    return {
      scheme_code: expected.scheme_code,
      verified: false,
      status: 'code_mismatch',
      expectedName: expected.name,
      expectedPlan: expected.plan,
      expectedOption: expected.option,
      expectedIsin: expected.isin,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin: provider.isin_growth || null,
      providerSource: 'mfapi',
      registryAsOfDate: rec?.amfiDate || null,
      reason: `Scheme code mismatch: expected ${expected.scheme_code}, received ${provider.scheme_code}.`,
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
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: rec?.amfiDate || null,
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
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          registryAsOfDate: rec?.amfiDate || null,
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
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          registryAsOfDate: rec?.amfiDate || null,
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
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          registryAsOfDate: rec?.amfiDate || null,
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
          providerName: provider.scheme_name,
          providerPlan: parsed.plan,
          providerOption: parsed.option,
          providerIsin,
          providerSource: 'mfapi',
          registryAsOfDate: rec?.amfiDate || null,
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
      providerName: provider.scheme_name,
      providerPlan: confirmedViaAmfiHistory127042 ? 'Direct' : parsed.plan,
      providerOption: confirmedViaAmfiHistory127042 ? 'Growth' : parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: rec?.amfiDate || null,
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
      providerName: provider.scheme_name,
      providerPlan: confirmedViaAmfiHistory127042 ? 'Direct' : parsed.plan,
      providerOption: confirmedViaAmfiHistory127042 ? 'Growth' : parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      registryAsOfDate: rec?.amfiDate || null,
      reason: `ISIN mismatch on code ${expected.scheme_code}: expected ${expected.isin}, provider returned ${providerIsin}.`,
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
    providerName: provider.scheme_name,
    providerPlan: confirmedViaAmfiHistory127042 ? 'Direct' : parsed.plan,
    providerOption: confirmedViaAmfiHistory127042 ? 'Growth' : parsed.option,
    providerIsin,
    providerSource: 'mfapi',
    registryAsOfDate: rec?.amfiDate || null,
    reason: rec?.reason || 'Verified scheme code, name, plan, option, and ISIN against mfapi.in.',
  };
}

export function validateDiscoveredSchemeIdentity(provider: ProviderSchemeMeta | null): SchemeIdentityAudit {
  if (!provider || !provider.scheme_code || !provider.scheme_name) {
    return {
      scheme_code: provider?.scheme_code || 0,
      verified: false,
      status: 'provider_error',
      expectedName: provider?.scheme_name || 'Unknown Scheme',
      expectedPlan: 'Unknown',
      expectedOption: 'Unknown',
      expectedIsin: null,
      providerName: provider?.scheme_name || null,
      providerPlan: 'Unknown',
      providerOption: 'Unknown',
      providerIsin: null,
      providerSource: 'unavailable',
      reason: 'Incomplete scheme metadata returned by mfapi.in.',
    };
  }

  const rec = PRESET_RECONCILIATION_TABLE[provider.scheme_code];
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
      provider
    );
  }

  const parsed = parsePlanAndOption(provider.scheme_name);
  const rawIsin =
    parsed.option === 'IDCW'
      ? provider.isin_div_reinvestment || provider.isin_growth || null
      : provider.isin_growth || null;
  const providerIsin = rawIsin ? rawIsin.trim().toUpperCase() : null;

  if (parsed.plan === 'Unknown' || parsed.option === 'Unknown') {
    return {
      scheme_code: provider.scheme_code,
      verified: false,
      status: 'plan_unverified',
      expectedName: provider.scheme_name,
      expectedPlan: parsed.plan,
      expectedOption: parsed.option,
      expectedIsin: providerIsin,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      reason: `Plan (${parsed.plan}) or option (${parsed.option}) could not be verified from scheme name "${provider.scheme_name}".`,
    };
  }

  if (!isValidIsin(providerIsin)) {
    return {
      scheme_code: provider.scheme_code,
      verified: false,
      status: 'unresolved_isin',
      expectedName: provider.scheme_name,
      expectedPlan: parsed.plan,
      expectedOption: parsed.option,
      expectedIsin: null,
      providerName: provider.scheme_name,
      providerPlan: parsed.plan,
      providerOption: parsed.option,
      providerIsin,
      providerSource: 'mfapi',
      reason: `Missing or invalid effective ISIN for scheme ${provider.scheme_code}.`,
    };
  }

  return {
    scheme_code: provider.scheme_code,
    verified: true,
    status: 'verified',
    expectedName: provider.scheme_name,
    expectedPlan: parsed.plan,
    expectedOption: parsed.option,
    expectedIsin: providerIsin,
    providerName: provider.scheme_name,
    providerPlan: parsed.plan,
    providerOption: parsed.option,
    providerIsin,
    providerSource: 'mfapi',
    reason: 'Verified scheme code, plan, option, and ISIN from mfapi.in.',
  };
}
