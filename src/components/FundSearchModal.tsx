import React, { useState, useMemo } from 'react';
import { Search, X, Check, Plus, Filter, AlertCircle, ArrowRight } from 'lucide-react';
import { FundMeta } from '../types/quant';
import { CATEGORIES_LIST, AMC_LIST } from '../data/presetFunds';

interface FundSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFunds: Record<number, FundMeta>;
  selectedCodes: number[];
  onToggleFund: (code: number) => void;
  onAddCustomScheme: (code: number) => Promise<void>;
}

export const FundSearchModal: React.FC<FundSearchModalProps> = ({
  isOpen,
  onClose,
  availableFunds,
  selectedCodes,
  onToggleFund,
  onAddCustomScheme,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAmc, setSelectedAmc] = useState('All AMCs');
  const [isQueryingMfapi, setIsQueryingMfapi] = useState(false);
  const [liveApiMessage, setLiveApiMessage] = useState<string | null>(null);

  const fundList = useMemo(() => Object.values(availableFunds), [availableFunds]);

  const filteredFunds = useMemo(() => {
    return fundList.filter((fund) => {
      const matchCat = selectedCategory === 'All' || fund.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchAmc = selectedAmc === 'All AMCs' || fund.fund_house === selectedAmc;
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        fund.name.toLowerCase().includes(term) ||
        fund.category.toLowerCase().includes(term) ||
        fund.fund_house.toLowerCase().includes(term) ||
        fund.isin.toLowerCase().includes(term) ||
        fund.scheme_code.toString().includes(term);

      return matchCat && matchAmc && matchSearch;
    });
  }, [fundList, selectedCategory, selectedAmc, searchTerm]);

  if (!isOpen) return null;

  const handleCustomLookup = async () => {
    const code = parseInt(searchTerm.trim(), 10);
    if (!code || isNaN(code)) {
      setLiveApiMessage('Enter a valid numerical scheme code (e.g. 120503, 118989)');
      return;
    }
    setIsQueryingMfapi(true);
    setLiveApiMessage(null);
    try {
      await onAddCustomScheme(code);
      setLiveApiMessage(`Successfully ingested Scheme ${code} from mfapi.in!`);
      setTimeout(() => setLiveApiMessage(null), 3000);
    } catch {
      setLiveApiMessage('Could not find scheme on mfapi.in. Please check code.');
    } finally {
      setIsQueryingMfapi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header & Search Bar */}
        <div className="p-5 border-b border-slate-800 space-y-4 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Mutual Fund Catalog &amp; Screener</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Search across all Indian equity, debt, hybrid, commodity and global schemes.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by fund name, AMC, scheme code, or ISIN (e.g. Parag Parikh, HDFC, 122639)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                autoFocus
              />
            </div>
            {searchTerm.trim().length > 3 && !isNaN(Number(searchTerm.trim())) && (
              <button
                onClick={handleCustomLookup}
                disabled={isQueryingMfapi}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
              >
                {isQueryingMfapi ? 'Fetching mfapi.in...' : 'Lookup Scheme Code'}
              </button>
            )}
          </div>

          {/* Live API Message */}
          {liveApiMessage && (
            <div className="text-xs px-3 py-1.5 rounded-lg bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{liveApiMessage}</span>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Category:</span>
            </div>
            <div className="flex flex-wrap gap-1 max-h-18 overflow-y-auto pr-1">
              {CATEGORIES_LIST.slice(0, 10).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* AMC Selector */}
            <div className="ml-auto">
              <select
                value={selectedAmc}
                onChange={(e) => setSelectedAmc(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                {AMC_LIST.map((amc) => (
                  <option key={amc} value={amc}>
                    {amc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span>Showing {filteredFunds.length} schemes</span>
            <span className="font-mono text-emerald-400 font-semibold">{selectedCodes.length} currently selected for comparison</span>
          </div>

          {filteredFunds.map((fund) => {
            const isSelected = selectedCodes.includes(fund.scheme_code);

            return (
              <div
                key={fund.scheme_code}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-800/80 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{fund.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      fund.asset_class === 'Debt' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' :
                      fund.asset_class === 'Hybrid' ? 'bg-purple-950 text-purple-300 border border-purple-800/50' :
                      fund.asset_class === 'Commodity' ? 'bg-yellow-950 text-yellow-300 border border-yellow-800/50' :
                      'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                    }`}>
                      {fund.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">ISIN: {fund.isin}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{fund.fund_house}</span>
                    <span>·</span>
                    <span className="font-mono text-slate-300">AUM: ₹{fund.aum_cr.toLocaleString()} Cr</span>
                    <span>·</span>
                    <span className="font-mono text-slate-300">TER (Direct): {fund.expense_ratio_direct}%</span>
                    <span>·</span>
                    <span className="text-slate-400">Manager: {fund.manager.name.split('(')[0]}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => onToggleFund(fund.scheme_code)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-rose-400" />
                        <span>Remove</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Compare</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredFunds.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <div className="text-slate-500 text-sm">No funds found matching &ldquo;{searchTerm}&rdquo;</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                You can lookup ANY of the 40,000+ mutual fund schemes in India by entering its AMFI Scheme Code in the search bar above.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-slate-300">Esc</kbd> to close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
