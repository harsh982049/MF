/**
 * AMFI Scheme Category Classifier and Holdings Synthesizer
 * Maps raw mfapi.in metadata into structured institutional FundMeta entities.
 */

import { FundMeta, FundHolding, AssetClass, CreditProfile } from '../types/quant';

export interface MfapiMeta {
  fund_house?: string;
  scheme_type?: string;
  scheme_category?: string;
  scheme_code: number;
  scheme_name: string;
  isin_growth?: string | null;
  isin_div_reinvestment?: string | null;
}

// Representative equity pools for look-through portfolio synthesis
const LARGE_CAP_POOL: FundHolding[] = [
  { isin: 'INE002A01018', name: 'Reliance Industries Ltd.', sector: 'Energy & Oil', mcap: 'Large Cap', weight: 8.8, adtv_cr: 1420.5 },
  { isin: 'INE040A01034', name: 'HDFC Bank Ltd.', sector: 'Banking & Finance', mcap: 'Large Cap', weight: 8.2, adtv_cr: 1850.2 },
  { isin: 'INE090A01021', name: 'ICICI Bank Ltd.', sector: 'Banking & Finance', mcap: 'Large Cap', weight: 7.4, adtv_cr: 1240.8 },
  { isin: 'INE009A01021', name: 'Infosys Ltd.', sector: 'Technology', mcap: 'Large Cap', weight: 6.2, adtv_cr: 980.4 },
  { isin: 'INE467B01029', name: 'Tata Consultancy Services', sector: 'Technology', mcap: 'Large Cap', weight: 5.5, adtv_cr: 760.1 },
  { isin: 'INE397D01024', name: 'Bharti Airtel Ltd.', sector: 'Telecom', mcap: 'Large Cap', weight: 5.1, adtv_cr: 650.3 },
  { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd.', sector: 'Capital Goods & Infrastructure', mcap: 'Large Cap', weight: 4.8, adtv_cr: 540.7 },
  { isin: 'INE154A01025', name: 'ITC Ltd.', sector: 'FMCG', mcap: 'Large Cap', weight: 4.3, adtv_cr: 610.2 },
  { isin: 'INE238A01034', name: 'Axis Bank Ltd.', sector: 'Banking & Finance', mcap: 'Large Cap', weight: 3.9, adtv_cr: 580.6 },
  { isin: 'INE062A01020', name: 'State Bank of India', sector: 'Banking & Finance', mcap: 'Large Cap', weight: 3.8, adtv_cr: 820.5 },
];

const MID_CAP_POOL: FundHolding[] = [
  { isin: 'INE848E01016', name: 'Trent Ltd.', sector: 'Retail & Consumer', mcap: 'Mid Cap', weight: 6.2, adtv_cr: 380.5 },
  { isin: 'INE263A01024', name: 'Bharat Electronics Ltd.', sector: 'Defense & Aerospace', mcap: 'Mid Cap', weight: 5.8, adtv_cr: 420.1 },
  { isin: 'INE262H01013', name: 'Persistent Systems Ltd.', sector: 'Technology', mcap: 'Mid Cap', weight: 5.2, adtv_cr: 260.4 },
  { isin: 'INE591G01017', name: 'Coforge Ltd.', sector: 'Technology', mcap: 'Mid Cap', weight: 4.9, adtv_cr: 220.8 },
  { isin: 'INE455K01017', name: 'Polycab India Ltd.', sector: 'Capital Goods', mcap: 'Mid Cap', weight: 4.7, adtv_cr: 245.3 },
  { isin: 'INE670A01012', name: 'Cummins India Ltd.', sector: 'Capital Goods & Engineering', mcap: 'Mid Cap', weight: 4.4, adtv_cr: 195.2 },
  { isin: 'INE171A01029', name: 'Federal Bank Ltd.', sector: 'Banking & Finance', mcap: 'Mid Cap', weight: 4.1, adtv_cr: 280.6 },
  { isin: 'INE027H01010', name: 'Max Healthcare Institute', sector: 'Healthcare & Pharma', mcap: 'Mid Cap', weight: 3.9, adtv_cr: 210.4 },
  { isin: 'INE053A01029', name: 'Indian Hotels Co. Ltd.', sector: 'Consumer Services & Hospitality', mcap: 'Mid Cap', weight: 3.8, adtv_cr: 310.2 },
  { isin: 'INE216A01030', name: 'Bharat Forge Ltd.', sector: 'Automobile & Ancillaries', mcap: 'Mid Cap', weight: 3.5, adtv_cr: 185.0 },
];

const SMALL_CAP_POOL: FundHolding[] = [
  { isin: 'INE064W01023', name: 'Kaynes Technology India', sector: 'Electronics Manufacturing', mcap: 'Small Cap', weight: 5.4, adtv_cr: 110.2 },
  { isin: 'INE732I01013', name: 'Angel One Ltd.', sector: 'Financial Services & Broking', mcap: 'Small Cap', weight: 5.1, adtv_cr: 145.6 },
  { isin: 'INE118H01025', name: 'BSE Ltd.', sector: 'Capital Markets & Exchange', mcap: 'Small Cap', weight: 4.8, adtv_cr: 190.4 },
  { isin: 'INE736A01011', name: 'Central Depository Services (CDSL)', sector: 'Financial Services', mcap: 'Small Cap', weight: 4.5, adtv_cr: 130.8 },
  { isin: 'INE043D01016', name: 'Suzlon Energy Ltd.', sector: 'Renewable Energy', mcap: 'Small Cap', weight: 4.2, adtv_cr: 175.0 },
  { isin: 'INE372A01015', name: 'Apar Industries Ltd.', sector: 'Power Cables & Engineering', mcap: 'Small Cap', weight: 3.9, adtv_cr: 85.4 },
  { isin: 'INE036D01028', name: 'Karur Vysya Bank Ltd.', sector: 'Banking & Finance', mcap: 'Small Cap', weight: 3.6, adtv_cr: 95.2 },
  { isin: 'INE269A01021', name: 'Sonata Software Ltd.', sector: 'Technology', mcap: 'Small Cap', weight: 3.4, adtv_cr: 78.5 },
  { isin: 'INE0BV301023', name: 'C.E. Info Systems (MapmyIndia)', sector: 'Technology & SaaS', mcap: 'Small Cap', weight: 3.2, adtv_cr: 64.2 },
  { isin: 'INE136B01020', name: 'Cyient Ltd.', sector: 'Engineering & R&D Services', mcap: 'Small Cap', weight: 3.0, adtv_cr: 82.0 },
];

const DEBT_HOLDINGS_POOL: FundHolding[] = [
  { isin: 'IN0020230085', name: '7.18% GOI Sovereign G-Sec 2033', sector: 'Sovereign Debt (G-Sec)', mcap: 'Cash / Sovereign', weight: 16.5, adtv_cr: 3200.0, creditRating: 'SOV' },
  { isin: 'IN0020220011', name: '7.26% GOI Sovereign G-Sec 2032', sector: 'Sovereign Debt (G-Sec)', mcap: 'Cash / Sovereign', weight: 14.0, adtv_cr: 2800.0, creditRating: 'SOV' },
  { isin: 'INE020B08DF2', name: 'REC Ltd. AAA Bond 2028', sector: 'Financial Institutions (AAA)', mcap: 'Debt / Fixed Income', weight: 9.8, adtv_cr: 450.0, creditRating: 'AAA' },
  { isin: 'INE261F08EU1', name: 'NABARD AAA Corporate Bond 2029', sector: 'Development Finance (AAA)', mcap: 'Debt / Fixed Income', weight: 9.2, adtv_cr: 380.0, creditRating: 'AAA' },
  { isin: 'INE134E08MW5', name: 'Power Finance Corp AAA 2027', sector: 'Financial Institutions (AAA)', mcap: 'Debt / Fixed Income', weight: 8.5, adtv_cr: 320.0, creditRating: 'AAA' },
  { isin: 'INE906B07HP0', name: 'NHAI AAA Tax-Free Bond 2031', sector: 'Infrastructure (AAA)', mcap: 'Debt / Fixed Income', weight: 7.8, adtv_cr: 260.0, creditRating: 'AAA' },
  { isin: 'INE040A08435', name: 'HDFC Bank Ltd. AAA Tier II Bond', sector: 'Private Banks (AAA)', mcap: 'Debt / Fixed Income', weight: 7.2, adtv_cr: 290.0, creditRating: 'AAA' },
  { isin: 'INE002A08534', name: 'Reliance Industries AAA Debenture', sector: 'Corporate Debentures (AAA)', mcap: 'Debt / Fixed Income', weight: 6.8, adtv_cr: 240.0, creditRating: 'AAA' },
  { isin: 'INE556F08KB6', name: 'SIDBI AAA Certificate of Deposit', sector: 'Money Market Instruments', mcap: 'Debt / Fixed Income', weight: 5.5, adtv_cr: 410.0, creditRating: 'A1+' },
  { isin: 'IN9999999999', name: 'TREPS / Sovereign Cash Equivalents', sector: 'Tri-Party Repo (TREPS)', mcap: 'Cash / Sovereign', weight: 4.7, adtv_cr: 8500.0, creditRating: 'SOV' },
];

/**
 * Classifies an AMFI scheme and synthesizes institutional FundMeta
 */
export function classifyAndBuildFundMeta(meta: MfapiMeta, latestNav?: number): FundMeta {
  const name = meta.scheme_name || `Scheme ${meta.scheme_code}`;
  const rawCat = (meta.scheme_category || '').toLowerCase();
  const rawName = name.toLowerCase();

  let assetClass: AssetClass = 'Equity';
  let category = 'Flexi Cap';
  let benchmarkSymbol = '^CRSLDX'; // Nifty 500 default
  let riskometer: 'Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High' = 'Very High';
  let holdings: FundHolding[] = [];
  let creditProfile: CreditProfile | undefined;
  let macDuration = 0;
  let ytm = 0;

  // 1. Detect Asset Class & Category
  if (
    rawCat.includes('debt') ||
    rawCat.includes('income') ||
    rawCat.includes('bond') ||
    rawCat.includes('liquid') ||
    rawCat.includes('money market') ||
    rawCat.includes('gilt') ||
    rawCat.includes('overnight') ||
    rawName.includes('debt') ||
    rawName.includes('liquid') ||
    rawName.includes('bond') ||
    rawName.includes('gilt')
  ) {
    assetClass = 'Debt';
    benchmarkSymbol = '^CRSLDX';
    riskometer = rawCat.includes('liquid') || rawCat.includes('overnight') ? 'Low' : 'Moderate';
    category = rawCat.includes('liquid')
      ? 'Liquid Fund'
      : rawCat.includes('gilt')
      ? 'Gilt Fund'
      : rawCat.includes('banking')
      ? 'Banking & PSU Debt'
      : 'Corporate Bond';

    holdings = DEBT_HOLDINGS_POOL;
    creditProfile = {
      sovereignPct: 45.0,
      aaaPct: 42.5,
      aaPct: 8.5,
      aAndBelowPct: 2.0,
      cashPct: 2.0,
    };
    macDuration = rawCat.includes('liquid') ? 0.25 : rawCat.includes('gilt') ? 6.5 : 3.8;
    ytm = 0.0735;
  } else if (
    rawCat.includes('hybrid') ||
    rawCat.includes('balanced') ||
    rawCat.includes('arbitrage') ||
    rawCat.includes('equity savings') ||
    rawName.includes('hybrid') ||
    rawName.includes('balanced')
  ) {
    assetClass = 'Hybrid';
    category = 'Balanced Advantage';
    benchmarkSymbol = '^CRSLDX';
    riskometer = 'High';

    // Mix of 5 top equities + 5 top debt holdings
    holdings = [
      ...LARGE_CAP_POOL.slice(0, 5).map((h) => ({ ...h, weight: Number((h.weight * 0.65).toFixed(1)) })),
      ...DEBT_HOLDINGS_POOL.slice(0, 5).map((h) => ({ ...h, weight: Number((h.weight * 0.35).toFixed(1)) })),
    ];
    creditProfile = {
      sovereignPct: 20.0,
      aaaPct: 15.0,
      aaPct: 0.0,
      aAndBelowPct: 0.0,
      cashPct: 65.0, // Remaining in equity/cash
    };
  } else if (rawCat.includes('gold') || rawCat.includes('silver') || rawName.includes('gold') || rawName.includes('silver')) {
    assetClass = 'Commodity';
    category = 'Gold ETF / Fund';
    benchmarkSymbol = '^CRSLDX';
    riskometer = 'High';
    holdings = [
      { isin: 'INE999G01010', name: 'Physical Gold Bullion (995 Fineness)', sector: 'Precious Metals', mcap: 'Large Cap', weight: 88.5, adtv_cr: 240.0 },
      { isin: 'INE999S01010', name: 'Sovereign Gold Bonds & Tranches', sector: 'Sovereign Gold', mcap: 'Large Cap', weight: 8.5, adtv_cr: 95.0 },
      { isin: 'IN9999999999', name: 'TREPS / Cash Collateral', sector: 'Cash Equivalents', mcap: 'Cash / Sovereign', weight: 3.0, adtv_cr: 5000.0 },
    ];
  } else if (rawCat.includes('small cap') || rawName.includes('small cap') || rawName.includes('smallcap')) {
    assetClass = 'Equity';
    category = 'Small Cap';
    benchmarkSymbol = 'NIFTY_MIDCAP_150.NS';
    riskometer = 'Very High';
    holdings = SMALL_CAP_POOL;
  } else if (rawCat.includes('mid cap') || rawName.includes('mid cap') || rawName.includes('midcap')) {
    assetClass = 'Equity';
    category = 'Mid Cap';
    benchmarkSymbol = 'NIFTY_MIDCAP_150.NS';
    riskometer = 'Very High';
    holdings = MID_CAP_POOL;
  } else if (
    rawCat.includes('large cap') ||
    rawCat.includes('bluechip') ||
    rawCat.includes('top 100') ||
    rawCat.includes('nifty 50') ||
    rawName.includes('large cap') ||
    rawName.includes('bluechip') ||
    rawName.includes('top 100') ||
    rawName.includes('nifty 50')
  ) {
    assetClass = 'Equity';
    category = 'Large Cap';
    benchmarkSymbol = '^NSEI'; // Nifty 50
    riskometer = 'Very High';
    holdings = LARGE_CAP_POOL;
  } else if (rawCat.includes('elss') || rawCat.includes('tax') || rawName.includes('elss') || rawName.includes('tax')) {
    assetClass = 'Equity';
    category = 'ELSS Tax Saver';
    benchmarkSymbol = '^CRSLDX';
    riskometer = 'Very High';
    holdings = [
      ...LARGE_CAP_POOL.slice(0, 6).map((h) => ({ ...h, weight: Number((h.weight * 0.7).toFixed(1)) })),
      ...MID_CAP_POOL.slice(0, 4).map((h) => ({ ...h, weight: Number((h.weight * 0.7).toFixed(1)) })),
    ];
  } else {
    // Default to Flexi Cap / Multi Cap
    assetClass = 'Equity';
    category = meta.scheme_category ? meta.scheme_category.replace('Equity Scheme - ', '') : 'Flexi Cap';
    benchmarkSymbol = '^CRSLDX';
    riskometer = 'Very High';
    holdings = [
      ...LARGE_CAP_POOL.slice(0, 5),
      ...MID_CAP_POOL.slice(0, 3),
      ...SMALL_CAP_POOL.slice(0, 2),
    ];
  }

  // Estimate realistic AUM based on fund house scale
  const fundHouse = meta.fund_house || 'Indian Mutual Fund AMC';
  let aumCr = 8500;
  if (fundHouse.includes('SBI') || fundHouse.includes('HDFC') || fundHouse.includes('ICICI')) {
    aumCr = 32500;
  } else if (fundHouse.includes('Nippon') || fundHouse.includes('Kotak') || fundHouse.includes('Axis')) {
    aumCr = 22400;
  } else if (fundHouse.includes('Parag') || fundHouse.includes('Quant') || fundHouse.includes('Mirae')) {
    aumCr = 18600;
  }

  // Check if Direct or Regular plan
  const isDirect = rawName.includes('direct');
  const expenseRatioDirect = isDirect ? 0.65 : 1.45;
  const expenseRatioRegular = isDirect ? 1.45 : 1.85;

  return {
    scheme_code: meta.scheme_code,
    name,
    category,
    asset_class: assetClass,
    fund_house: fundHouse,
    benchmark_symbol: benchmarkSymbol,
    isin: meta.isin_growth || `INF${meta.scheme_code}`,
    aum_cr: aumCr,
    inception_date: '2015-01-01',
    expense_ratio_direct: expenseRatioDirect,
    expense_ratio_regular: expenseRatioRegular,
    turnover_ratio_pct: assetClass === 'Debt' ? 75.0 : 28.5,
    riskometer,
    exit_load: assetClass === 'Debt' ? 'Nil after 30 days' : '1% if redeemed within 365 days; Nil thereafter.',
    min_sip_inr: 500,
    min_lumpsum_inr: 1000,
    investment_objective: `To generate long-term capital appreciation or income by investing primarily in a diversified portfolio conforming to ${category} regulations.`,
    manager: {
      name: `${fundHouse.split(' ')[0]} Investment Team`,
      tenureYears: 4.5,
      overallExpYears: 18,
      education: 'MBA (Finance), CFA / CA',
      bio: `Dedicated portfolio management team at ${fundHouse} specializing in quantitative risk budgeting and active asset allocation.`,
      otherFundsManaged: [],
    },
    holdings,
    credit_profile: creditProfile,
    macaulay_duration: macDuration,
    ytm: ytm,
  };
}
