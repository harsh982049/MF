import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Check,
  Plus,
  Filter,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingUp,
  Database,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { FundMeta } from '../types/quant';
import { parsePlanAndOption } from '../utils/schemeIdentity';
import {
  previewSchemeWorkflow,
  SchemeExpectationInput,
  SchemePreviewResult,
} from '../utils/schemeWorkflow';

interface SchemeSearchItem {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string | null;
  isinDivReinvestment?: string | null;
}

interface FundSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFunds: Record<number, FundMeta>;
  selectedCodes: number[];
  onToggleFund: (code: number) => void;
  onAddCustomScheme: (
    code: number,
    expectation?: Partial<SchemeExpectationInput>
  ) => Promise<{ ok: boolean; message?: string }>;
}

export const FundSearchModal: React.FC<FundSearchModalProps> = ({
  isOpen,
  onClose,
  selectedCodes,
  onToggleFund,
  onAddCustomScheme,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'catalog'>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SchemeSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [catalogList, setCatalogList] = useState<SchemeSearchItem[]>([]);
  const [catalogOffset, setCatalogOffset] = useState(0);
  const catalogLimit = 50;
  const totalSchemesCount = 38038;
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('All');
  const [addingCode, setAddingCode] = useState<number | null>(null);
  const [actionBanner, setActionBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [previewScheme, setPreviewScheme] = useState<SchemePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewCache = useRef<Record<number, SchemePreviewResult>>({});
  const searchReqSeq = useRef(0);
  const previewReqSeq = useRef(0);

  // 1. Fetch Paginated Catalog
  useEffect(() => {
    if (!isOpen || activeTab !== 'catalog') return;

    let isMounted = true;
    setIsCatalogLoading(true);
    setCatalogError(null);

    const loadCatalog = async () => {
      try {
        const resp = await fetch(`https://api.mfapi.in/mf?limit=${catalogLimit}&offset=${catalogOffset}`);
        if (!resp.ok) {
          if (isMounted) setCatalogError(`Catalog request failed (HTTP ${resp.status}).`);
          return;
        }
        const data: SchemeSearchItem[] = await resp.json();
        if (isMounted) setCatalogList(data);
      } catch (err) {
        if (isMounted) {
          setCatalogError(err instanceof Error ? err.message : 'Network error loading mfapi catalog.');
        }
      } finally {
        if (isMounted) setIsCatalogLoading(false);
      }
    };

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTab, catalogOffset]);

  // 2. Debounced Live Search
  useEffect(() => {
    if (!isOpen) return;

    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const seq = ++searchReqSeq.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(term)}`);
        if (seq !== searchReqSeq.current) return;
        if (resp.ok) {
          const data: SchemeSearchItem[] = await resp.json();
          setSearchResults(data);
        } else {
          setSearchError(`Search service returned HTTP ${resp.status}.`);
        }
      } catch {
        if (seq === searchReqSeq.current) {
          setSearchError('Network error while querying mfapi.in search endpoint.');
        }
      } finally {
        if (seq === searchReqSeq.current) {
          setIsSearching(false);
        }
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  const buildExpectationFromItem = (item: SchemeSearchItem): Partial<SchemeExpectationInput> => {
    const parsed = parsePlanAndOption(item.schemeName);
    const expectedIsin =
      parsed.option === 'IDCW'
        ? item.isinDivReinvestment || item.isinGrowth || null
        : item.isinGrowth || null;
    return {
      requestedCode: item.schemeCode,
      expectedName: item.schemeName,
      expectedPlan: parsed.plan,
      expectedOption: parsed.option,
      expectedIsin,
    };
  };

  // 3. Preview Scheme with shared workflow (requested code check, trusted registry & NAV cutoff/freshness)
  const handlePreviewScheme = async (item: SchemeSearchItem) => {
    if (previewCache.current[item.schemeCode]) {
      setPreviewScheme(previewCache.current[item.schemeCode]);
      return;
    }

    const seq = ++previewReqSeq.current;
    setIsPreviewLoading(true);
    try {
      const expectation = buildExpectationFromItem(item);
      const schemeInfo = await previewSchemeWorkflow({
        requestedCode: item.schemeCode,
        expectedName: expectation.expectedName,
        expectedPlan: expectation.expectedPlan,
        expectedOption: expectation.expectedOption,
        expectedIsin: expectation.expectedIsin,
      });
      if (seq !== previewReqSeq.current) return;

      // Never retain failed, mismatched, or unverified payloads in the preview cache
      if (schemeInfo.shouldCachePreview) {
        previewCache.current[item.schemeCode] = schemeInfo;
      }
      setPreviewScheme(schemeInfo);
    } finally {
      if (seq === previewReqSeq.current) {
        setIsPreviewLoading(false);
      }
    }
  };

  // 4. Add or Remove Fund with verified error propagation & full expectation passing
  const handleActionClick = async (code: number, item?: SchemeSearchItem) => {
    if (selectedCodes.includes(code)) {
      onToggleFund(code);
      return;
    }

    setAddingCode(code);
    setActionBanner(null);
    try {
      const expectation = item
        ? buildExpectationFromItem(item)
        : previewScheme && previewScheme.scheme_code === code
        ? {
            requestedCode: code,
            expectedName: previewScheme.identity.expectedName,
            expectedPlan: previewScheme.identity.expectedPlan,
            expectedOption: previewScheme.identity.expectedOption,
            expectedIsin: previewScheme.identity.expectedIsin,
          }
        : { requestedCode: code };

      const outcome = await onAddCustomScheme(code, expectation);
      if (outcome.ok) {
        setActionBanner({
          kind: 'success',
          text: outcome.message || `Added scheme ${code} after identity & NAV validation.`,
        });
      } else {
        setActionBanner({
          kind: 'error',
          text: outcome.message || `Scheme ${code} blocked: identity or NAV validation failed.`,
        });
      }
      setTimeout(() => setActionBanner(null), 5000);
    } catch (err) {
      setActionBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : `Failed to validate and add scheme ${code}.`,
      });
    } finally {
      setAddingCode(null);
    }
  };

  const matchesFilter = (schemeName: string) => {
    const s = schemeName.toLowerCase();
    if (filterType === 'All') return true;
    if (filterType === 'Direct') return s.includes('direct');
    if (filterType === 'Regular') return !s.includes('direct');
    if (filterType === 'Growth') return s.includes('growth');
    if (filterType === 'Dividend') return s.includes('dividend') || s.includes('idcw');
    if (filterType === 'Equity') return s.includes('equity') || s.includes('cap') || s.includes('bluechip');
    if (filterType === 'Debt') return s.includes('debt') || s.includes('bond') || s.includes('liquid') || s.includes('gilt') || s.includes('income');
    if (filterType === 'Hybrid') return s.includes('hybrid') || s.includes('balanced') || s.includes('arbitrage');
    if (filterType === 'Index') return s.includes('index') || s.includes('etf') || s.includes('nifty') || s.includes('sensex');
    return true;
  };

  const displayItems = useMemo(() => {
    const raw = activeTab === 'search' && searchTerm.trim().length >= 2 ? searchResults : catalogList;
    return raw.filter((item) => matchesFilter(item.schemeName));
  }, [activeTab, searchTerm, searchResults, catalogList, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Universal Indian Mutual Funds Explorer</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded font-mono font-medium">
                    Identity-Gated Live Feed
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Third-party AMFI mirror (mfapi.in). Discovered schemes provide validated NAV &amp; identity only; AMC factsheets &amp; holdings show Unavailable until ingested.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                Comparing: <span className="text-emerald-400 font-bold">{selectedCodes.length}</span> funds
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar & Mode Switch */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (activeTab !== 'search') setActiveTab('search');
                }}
                placeholder="Search fund name, AMC, scheme code (e.g., Parag Parikh, HDFC, SBI, 122639)..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start sm:self-auto shrink-0">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Search {searchTerm && searchResults.length > 0 && `(${searchResults.length})`}
              </button>
              <button
                onClick={() => {
                  setActiveTab('catalog');
                  setSearchTerm('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Schemes Directory (38k)
              </button>
            </div>
          </div>

          {/* Quick Filter Segmented Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-400" /> Filter:
            </span>
            {['All', 'Direct', 'Regular', 'Growth', 'Dividend', 'Equity', 'Debt', 'Hybrid', 'Index'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  filterType === f
                    ? 'bg-slate-200 text-slate-900 font-bold shadow-xs'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {actionBanner && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                actionBanner.kind === 'success'
                  ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-800/80 text-rose-200'
              }`}
            >
              {actionBanner.kind === 'success' ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              )}
              <span>{actionBanner.text}</span>
            </div>
          )}

          {(searchError || catalogError) && (
            <div className="text-xs px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{searchError || catalogError}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 border-r border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
              <span>
                {activeTab === 'search' ? (
                  searchTerm.trim().length >= 2 ? (
                    `Found ${searchResults.length} matching schemes`
                  ) : (
                    'Type at least 2 characters to search schemes'
                  )
                ) : (
                  `Showing schemes ${catalogOffset + 1} to ${Math.min(catalogOffset + catalogLimit, totalSchemesCount)} of ${totalSchemesCount.toLocaleString()}`
                )}
              </span>

              {(isSearching || isCatalogLoading) && (
                <span className="flex items-center gap-1 text-indigo-400 font-mono text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Querying mfapi.in...
                </span>
              )}
            </div>

            {displayItems.map((item) => {
              const isSelected = selectedCodes.includes(item.schemeCode);
              const isAdding = addingCode === item.schemeCode;

              return (
                <div
                  key={item.schemeCode}
                  onMouseEnter={() => handlePreviewScheme(item)}
                  onClick={() => handlePreviewScheme(item)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500/60 shadow-sm'
                      : previewScheme?.scheme_code === item.schemeCode
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate" title={item.schemeName}>
                        {item.schemeName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span className="text-indigo-400 font-semibold">Code: {item.schemeCode}</span>
                      {item.isinGrowth && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500">ISIN: {item.isinGrowth}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleActionClick(item.schemeCode, item)}
                      disabled={isAdding}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/70'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                      }`}
                    >
                      {isAdding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validating...</span>
                        </>
                      ) : isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Compare</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {displayItems.length === 0 && !isSearching && !isCatalogLoading && (
              <div className="py-14 text-center space-y-3">
                <div className="text-slate-400 text-sm font-medium">
                  {searchTerm ? `No schemes found matching "${searchTerm}"` : 'No schemes available in this view'}
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Search by AMC or scheme code (e.g. &ldquo;Parag Parikh&rdquo;, &ldquo;HDFC&rdquo;, &ldquo;SBI&rdquo;, or 122639).
                </p>
              </div>
            )}
          </div>

          {/* Right Preview Drawer */}
          <div className="w-full md:w-80 shrink-0 bg-slate-950/90 border-t md:border-t-0 md:border-l border-slate-800 p-4.5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" /> Scheme Preview
                </span>
                {isPreviewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              </div>

              {previewScheme ? (
                <div className="space-y-3.5 pt-3">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight">
                      {previewScheme.scheme_name}
                    </h3>
                    <div className="text-[11px] font-mono text-indigo-400 mt-1">
                      Requested Code: {previewScheme.scheme_code}
                    </div>
                  </div>

                  {/* Identity Status Badge */}
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                      previewScheme.accepted
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-800/70 text-rose-200'
                    }`}
                  >
                    {previewScheme.accepted ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold uppercase tracking-wider text-[10px]">
                        Identity: {previewScheme.identity.status.replace(/_/g, ' ')}
                        {previewScheme.analyticsSuppressed ? ' (Analytics Suppressed)' : ''}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5 leading-snug">
                        {previewScheme.previewError || previewScheme.identity.reason}
                      </div>
                    </div>
                  </div>

                  {previewScheme.accepted && previewScheme.latestNav ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Validated Latest NAV (mfapi.in)
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-xl font-mono font-bold text-emerald-400">
                          ₹{parseFloat(previewScheme.latestNav).toFixed(4)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          as of {previewScheme.latestDate}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 text-[11px] text-amber-300">
                      NAV &amp; research preview suppressed: scheme did not pass trusted AMFI registry &amp; NAV validation.
                    </div>
                  )}

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Registry Match</span>
                      <span className={`font-mono font-semibold ${previewScheme.identity.registryMatched ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {previewScheme.identity.registryMatched
                          ? `AMFI #${previewScheme.identity.registrySchemeCode} (${previewScheme.identity.registryAsOfDate})`
                          : 'Unverified / Absent'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Fetched Code</span>
                      <span className="font-mono text-slate-200">
                        {previewScheme.identity.providerSchemeCode ?? 'Unavailable'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Fund House</span>
                      <span className="font-medium text-slate-200 text-right truncate max-w-[150px]">
                        {previewScheme.fund_house || 'Unavailable'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Plan / Option</span>
                      <span className="font-medium text-slate-200 text-right">
                        {previewScheme.identity.providerPlan} / {previewScheme.identity.providerOption}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Fetched ISIN</span>
                      <span className="font-mono text-slate-300">
                        {previewScheme.identity.providerIsin || 'Unavailable'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">AMC Holdings &amp; TER</span>
                      <span className="text-amber-400 font-mono text-[11px]">Unavailable (Batch 5)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActionClick(previewScheme.scheme_code)}
                    disabled={addingCode === previewScheme.scheme_code}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      selectedCodes.includes(previewScheme.scheme_code)
                        ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {selectedCodes.includes(previewScheme.scheme_code) ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Remove from Comparison</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Validate &amp; Add to Analytics</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <TrendingUp className="w-6 h-6 mx-auto text-slate-600" />
                  <p>Hover or click any scheme to inspect identity verification status and live mfapi.in metadata.</p>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span>Source: api.mfapi.in (AMFI mirror)</span>
              <span className={searchError || catalogError ? 'text-rose-400' : 'text-slate-400'}>
                {searchError || catalogError ? 'Feed Error' : 'Identity Check Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/95 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          {activeTab === 'catalog' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCatalogOffset(Math.max(0, catalogOffset - catalogLimit))}
                disabled={catalogOffset === 0 || isCatalogLoading}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous 50
              </button>
              <span className="font-mono text-slate-300">
                Page {Math.floor(catalogOffset / catalogLimit) + 1} of {Math.ceil(totalSchemesCount / catalogLimit)}
              </span>
              <button
                onClick={() => setCatalogOffset(catalogOffset + catalogLimit)}
                disabled={catalogOffset + catalogLimit >= totalSchemesCount || isCatalogLoading}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                Next 50 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div>
              {searchResults.length > 0
                ? `Search query returned ${searchResults.length} scheme matches`
                : 'Scheme identity, plan, option, ISIN, and NAV freshness verified on add'}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-slate-500 hidden sm:inline">Press Esc to close</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Done &amp; View Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
