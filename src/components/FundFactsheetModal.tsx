import React from 'react';
import { X, User, Shield, Award, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { FundMeta } from '../types/quant';

interface FundFactsheetModalProps {
  fund: FundMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FundFactsheetModal: React.FC<FundFactsheetModalProps> = ({ fund, isOpen, onClose }) => {
  if (!isOpen || !fund) return null;

  const unavailableText = (reason?: string) => (
    <span className="text-slate-500 font-normal text-xs" title={reason}>
      Unavailable
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white tracking-tight">{fund.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-medium">
                {fund.category}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ISIN: {fund.isin ?? 'Unavailable'}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
              <span>{fund.fund_house}</span>
              <span>·</span>
              <span>Scheme Code: <span className="font-mono text-slate-200">{fund.scheme_code}</span></span>
              <span>·</span>
              <span>Plan: <span className="font-mono text-slate-200">{fund.plan} / {fund.option}</span></span>
              <span>·</span>
              <span>Benchmark Target: <span className="font-semibold text-amber-400">{fund.benchmark_symbol}</span></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Provenance Strip */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              fund.identityStatus.verified
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : 'bg-rose-950/50 border-rose-800/70 text-rose-200'
            }`}
          >
            {fund.identityStatus.verified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                Identity Verification: {fund.identityStatus.status.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                {fund.identityStatus.reason || 'Scheme identity check applied.'}
              </div>
              <div className="text-[10px] font-mono opacity-80 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Registry: {fund.identityStatus.registryMatched
                    ? `${fund.identityStatus.registrySchemeCode} (${fund.identityStatus.registryIsin ?? 'No ISIN'})`
                    : 'Not matched in AMFI registry'}
                </span>
                <span>
                  Fetched Feed: {fund.identityStatus.providerSchemeCode ?? 'Unavailable'} (
                  {fund.identityStatus.providerName ?? 'Unavailable'} ·{' '}
                  {fund.identityStatus.providerIsin ?? 'No ISIN'})
                </span>
              </div>
            </div>
          </div>

          {/* Key Factsheet Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Fund AUM</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">
                {fund.aum_cr !== null ? `₹${fund.aum_cr.toLocaleString()} Cr` : unavailableText()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {fund.aum_as_of ? `As of ${fund.aum_as_of}` : 'AMC disclosure not ingested'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 uppercase font-medium">TER (Direct / Regular)</div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                {fund.expense_ratio_direct !== null ? (
                  <>
                    {fund.expense_ratio_direct}%{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      / {fund.expense_ratio_regular !== null ? `${fund.expense_ratio_regular}%` : 'Unavailable'}
                    </span>
                  </>
                ) : (
                  unavailableText()
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Annual Total Expense Ratio</div>
            </div>

            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Portfolio Turnover</div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                {fund.turnover_ratio_pct !== null ? `${fund.turnover_ratio_pct}%` : unavailableText()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">AMC disclosed churn rate</div>
            </div>

            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 uppercase font-medium">SEBI Riskometer</div>
              <div
                className={`text-base font-bold mt-1 ${
                  fund.riskometer === 'Very High'
                    ? 'text-rose-400'
                    : fund.riskometer === 'High'
                    ? 'text-amber-400'
                    : fund.riskometer
                    ? 'text-emerald-400'
                    : 'text-slate-500 font-normal text-sm'
                }`}
              >
                {fund.riskometer ?? 'Unavailable'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Principal at risk rating</div>
            </div>
          </div>

          {/* Manager Dossier Card */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Fund Manager Profile &amp; Track Record</span>
            </div>

            {fund.manager ? (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">{fund.manager.name}</div>
                    <div className="text-slate-400 mt-0.5">{fund.manager.education ?? 'Unavailable'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-400 font-semibold">
                      {fund.manager.tenureYears !== null ? `${fund.manager.tenureYears} Years on this fund` : 'Tenure: Unavailable'}
                    </div>
                    <div className="text-slate-500 text-[11px] font-mono">
                      {fund.manager.overallExpYears !== null ? `${fund.manager.overallExpYears} Years experience` : 'Experience: Unavailable'}
                    </div>
                  </div>
                </div>

                {fund.manager.bio && <p className="text-slate-300 leading-relaxed pt-1">{fund.manager.bio}</p>}

                {fund.manager.otherFundsManaged.length > 0 && (
                  <div className="pt-2 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">Other Mandates Managed: </span>
                    <span>{fund.manager.otherFundsManaged.join(', ')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                Unavailable — Fund manager bio and tenure require an official AMC scheme disclosure.
              </div>
            )}
          </div>

          {/* Investment Objective & Operational Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Investment Mandate &amp; Philosophy</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {fund.investment_objective ?? (
                  <span className="text-slate-500 italic">
                    Unavailable — SID/KIM investment objective not ingested for this scheme.
                  </span>
                )}
              </p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Investment Operational Terms</span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Inception Date:</span>
                  <span className="font-mono">{fund.inception_date ?? 'Unavailable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exit Load:</span>
                  <span className="text-right truncate max-w-[220px]" title={fund.exit_load ?? 'Unavailable'}>
                    {fund.exit_load ?? 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Minimum SIP Amount:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {fund.min_sip_inr !== null ? `₹${fund.min_sip_inr.toLocaleString()}` : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Minimum Lumpsum:</span>
                  <span className="font-mono">
                    {fund.min_lumpsum_inr !== null ? `₹${fund.min_lumpsum_inr.toLocaleString()}` : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Debt Profile (if applicable) */}
          {fund.asset_class === 'Debt' && (
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Debt Portfolio Credit Rating &amp; Duration Profile</span>
              </div>

              {fund.credit_profile || fund.macaulay_duration != null || fund.ytm != null ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-950 rounded-lg">
                      <div className="text-slate-400 text-[10px]">Portfolio YTM</div>
                      <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                        {fund.ytm != null ? `${(fund.ytm * 100).toFixed(2)}%` : 'Unavailable'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-lg">
                      <div className="text-slate-400 text-[10px]">Macaulay Duration</div>
                      <div className="font-mono font-bold text-white text-sm mt-0.5">
                        {fund.macaulay_duration != null ? `${fund.macaulay_duration.toFixed(2)} yrs` : 'Unavailable'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-lg">
                      <div className="text-slate-400 text-[10px]">Modified Duration</div>
                      <div className="font-mono font-bold text-white text-sm mt-0.5">
                        {fund.modified_duration != null ? `${fund.modified_duration.toFixed(2)} yrs` : 'Unavailable'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-lg">
                      <div className="text-slate-400 text-[10px]">Average Maturity</div>
                      <div className="font-mono font-bold text-white text-sm mt-0.5">
                        {fund.avg_maturity_years != null ? `${fund.avg_maturity_years.toFixed(2)} yrs` : 'Unavailable'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  Unavailable — Debt YTM, maturity, duration, and credit-rating mix require a sourced AMC monthly debt disclosure.
                </div>
              )}
            </div>
          )}

          {/* Top Holdings Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Portfolio Holdings</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {fund.holdings && fund.holdings.length > 0
                  ? `${fund.holdings.length} disclosed line items · Coverage: ${
                      fund.holdingsStatus.disclosedWeightPct !== null && fund.holdingsStatus.disclosedWeightPct !== undefined
                        ? `${fund.holdingsStatus.disclosedWeightPct.toFixed(2)}% disclosed / ${(fund.holdingsStatus.unknownWeightPct ?? 0).toFixed(2)}% unknown`
                        : fund.holdingsStatus.partialCoverage
                        ? 'partial subset'
                        : 'full'
                    }`
                  : 'Unavailable'}
              </span>
            </div>

            {fund.holdings && fund.holdings.length > 0 && fund.holdingsStatus.partialCoverage && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200">
                Partial holdings disclosure: {fund.holdingsStatus.disclosedWeightPct?.toFixed(2) ?? 'Partial'}% disclosed;{' '}
                {fund.holdingsStatus.unknownWeightPct?.toFixed(2) ?? 'Remainder'}% unknown/undisclosed. Exact full-portfolio overlap is suppressed until ≥95% coverage is ingested.
              </div>
            )}

            {fund.holdings && fund.holdings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-sans text-left border-b border-slate-800">
                      <th className="py-2 px-3">ISIN</th>
                      <th className="py-2 px-3">Holding Name</th>
                      <th className="py-2 px-3">Sector / Asset</th>
                      <th className="py-2 px-3">Segment</th>
                      <th className="py-2 px-3 text-right">Portfolio Weight</th>
                      <th className="py-2 px-3 text-right">30D ADTV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {fund.holdings.map((h) => (
                      <tr key={h.isin} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-500">{h.isin}</td>
                        <td className="py-2 px-3 font-sans text-slate-200 font-medium">{h.name}</td>
                        <td className="py-2 px-3 text-slate-400">{h.sector}</td>
                        <td className="py-2 px-3 text-slate-400">{h.mcap}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">{h.weight.toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {h.adtv_cr !== null ? `₹${h.adtv_cr.toLocaleString()} Cr` : 'Unavailable'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
                {fund.holdingsStatus.reason || 'Unavailable: Security-level holdings disclosure not ingested.'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="text-[11px]">
            Provenance: {fund.disclosureSource || 'Unavailable — no statutory AMC disclosure ingested.'}
            {fund.asOfDate ? ` (As-of: ${fund.asOfDate})` : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Close Factsheet
          </button>
        </div>
      </div>
    </div>
  );
};
