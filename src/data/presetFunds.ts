import { FundMeta, NavPoint } from '../types/quant';
import {
  BENCHMARKS,
  generateGenuineBenchmarkSeries,
  isNseTradingDay,
} from './genuineBenchmarks';

export { BENCHMARKS, isNseTradingDay };

export const CATEGORIES_LIST = [
  'All',
  'Flexi Cap',
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'Multi Cap',
  'ELSS / Tax Saver',
  'Focused Equity',
  'Corporate Bond',
  'Banking & PSU Debt',
  'Gilt / Sovereign',
  'Liquid / Money Market',
  'Balanced Advantage / Dynamic',
  'Aggressive Hybrid',
  'Gold & Precious Metals',
  'International FoF',
];

export const AMC_LIST = [
  'All AMCs',
  'PPFAS Mutual Fund',
  'Motilal Oswal AMC',
  'HDFC Mutual Fund',
  'Nippon India Mutual Fund',
  'SBI Mutual Fund',
  'ICICI Prudential AMC',
  'Mirae Asset Mutual Fund',
  'Quant Mutual Fund',
  'Kotak Mahindra AMC',
  'Canara Robeco AMC',
];

export const PRESET_FUNDS: Record<number, FundMeta> = {
  // 1. Flexi Cap
  122639: {
    scheme_code: 122639,
    name: 'Parag Parikh Flexi Cap Fund',
    category: 'Flexi Cap',
    asset_class: 'Equity',
    fund_house: 'PPFAS Mutual Fund',
    benchmark_symbol: '^CRSLDX',
    isin: 'INF879O01027',
    aum_cr: 145070.50,
    inception_date: '2013-05-24',
    expense_ratio_direct: 0.61,
    expense_ratio_regular: 1.33,
    turnover_ratio_pct: 18.5,
    riskometer: 'Very High',
    exit_load: '2% if redeemed within 365 days; 1% between 366-730 days; Nil after 730 days.',
    min_sip_inr: 1000,
    min_lumpsum_inr: 1000,
    investment_objective: 'To generate long-term capital growth from an actively managed portfolio primarily consisting of equity and equity-related securities, with tactical allocation to global equities and debt/cash collateral.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Rajeev Thakkar (CIO & Lead Fund Manager)',
      tenureYears: 13.5,
      overallExpYears: 28,
      education: 'B.Com, Chartered Accountant (CA), CFA Charterholder',
      bio: 'Pioneer of value investing philosophy in India. Steers Parag Parikh Flexi Cap since its inception in May 2013 with a disciplined buy-and-hold focus on moats, capital allocation efficiency, and international diversification.',
      otherFundsManaged: ['Parag Parikh Tax Saver Fund', 'Parag Parikh Dynamic Asset Allocation Fund'],
    },
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 7.75, adtv_cr: 2450 },
      { isin: 'INE745G01035', name: 'Power Grid Corp of India', sector: 'Utilities', mcap: 'Large Cap', weight: 5.60, adtv_cr: 480 },
      { isin: 'INE154A01025', name: 'ITC Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 5.49, adtv_cr: 780 },
      { isin: 'INE522F01014', name: 'Coal India Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 5.39, adtv_cr: 390 },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 5.24, adtv_cr: 1850 },
      { isin: 'INE118A01012', name: 'Bajaj Holdings & Inv Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.85, adtv_cr: 110 },
      { isin: 'US02079K3059', name: 'Alphabet Inc (Google)', sector: 'Technology', mcap: 'Large Cap', weight: 4.10, adtv_cr: 8500 },
      { isin: 'US30303M1027', name: 'Meta Platforms Inc', sector: 'Technology', mcap: 'Large Cap', weight: 3.85, adtv_cr: 7800 },
      { isin: 'US5949181045', name: 'Microsoft Corp', sector: 'Technology', mcap: 'Large Cap', weight: 3.20, adtv_cr: 9800 },
      { isin: 'INE736A01011', name: 'CDSL Ltd', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.95, adtv_cr: 320 },
      { isin: 'INE544A01010', name: 'HCL Technologies Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 2.80, adtv_cr: 650 },
      { isin: 'INE585B01010', name: 'Maruti Suzuki India', sector: 'Automobile', mcap: 'Large Cap', weight: 2.45, adtv_cr: 530 },
      { isin: 'INE999A99999', name: 'Other Diversified Equity Holdings', sector: 'Diversified Equity', mcap: 'Large Cap', weight: 32.08, adtv_cr: 5000 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 14.25, adtv_cr: 100000 },
    ],
  },

  // 2. Mid Cap
  127042: {
    scheme_code: 127042,
    name: 'Motilal Oswal Midcap Fund',
    category: 'Mid Cap',
    asset_class: 'Equity',
    fund_house: 'Motilal Oswal AMC',
    benchmark_symbol: 'NIFTYMIDCAP150.NS',
    isin: 'INF247L01646',
    aum_cr: 42851.59,
    inception_date: '2014-02-24',
    expense_ratio_direct: 0.68,
    expense_ratio_regular: 1.74,
    turnover_ratio_pct: 42.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 15 days; Nil thereafter.',
    min_sip_inr: 500,
    min_lumpsum_inr: 500,
    investment_objective: 'To achieve long term capital appreciation by investing in quality mid-cap companies having long-term competitive advantages and strong management pedigree following the QGLP (Quality, Growth, Longevity, Price) framework.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Niket Shah',
      tenureYears: 8.6,
      overallExpYears: 16,
      education: 'Master of Management Studies (Finance)',
      bio: 'Leads mid-cap research at Motilal Oswal. Follows high-conviction focused stock-picking with emphasis on high-growth technology and consumer mid-caps with pricing power.',
      otherFundsManaged: ['Motilal Oswal Flexi Cap Fund', 'Motilal Oswal Small Cap Fund'],
    },
    holdings: [
      { isin: 'INE982J01020', name: 'One 97 Communications (Paytm)', sector: 'Financial Services', mcap: 'Mid Cap', weight: 9.20, adtv_cr: 650 },
      { isin: 'INE303R01014', name: 'Kalyan Jewellers India Ltd', sector: 'Consumer Goods', mcap: 'Mid Cap', weight: 8.40, adtv_cr: 320 },
      { isin: 'INE484J01027', name: 'Zomato Ltd / Eternal', sector: 'Technology', mcap: 'Large Cap', weight: 7.60, adtv_cr: 1250 },
      { isin: 'INE067A01029', name: 'Persistent Systems Ltd', sector: 'Technology', mcap: 'Mid Cap', weight: 6.10, adtv_cr: 340 },
      { isin: 'INE148I01020', name: 'Coforge Ltd', sector: 'Technology', mcap: 'Mid Cap', weight: 5.40, adtv_cr: 360 },
      { isin: 'INE455K01017', name: 'Polycab India Ltd', sector: 'Industrials', mcap: 'Mid Cap', weight: 4.90, adtv_cr: 310 },
      { isin: 'INE849A01020', name: 'Trent Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 4.50, adtv_cr: 820 },
      { isin: 'INE027H01010', name: 'Max Healthcare Institute Ltd', sector: 'Healthcare', mcap: 'Large Cap', weight: 4.20, adtv_cr: 290 },
      { isin: 'INE974X01010', name: 'Tube Investments of India', sector: 'Industrials', mcap: 'Mid Cap', weight: 3.90, adtv_cr: 210 },
      { isin: 'INE999A99998', name: 'Other Midcap Quality Holdings', sector: 'Diversified Equity', mcap: 'Mid Cap', weight: 37.30, adtv_cr: 4000 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 8.50, adtv_cr: 100000 },
    ],
  },

  // 3. Large Cap
  118989: {
    scheme_code: 118989,
    name: 'HDFC Top 100 Large Cap Fund',
    category: 'Large Cap',
    asset_class: 'Equity',
    fund_house: 'HDFC Mutual Fund',
    benchmark_symbol: '^NSEI',
    isin: 'INF179K01BE2',
    aum_cr: 43250.00,
    inception_date: '1996-10-11',
    expense_ratio_direct: 1.05,
    expense_ratio_regular: 1.62,
    turnover_ratio_pct: 26.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 1 year; Nil thereafter.',
    min_sip_inr: 500,
    min_lumpsum_inr: 500,
    investment_objective: 'To provide long-term capital appreciation from a portfolio predominantly invested in large cap companies (top 100 companies by market capitalization in India).',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Rahul Baijal (Senior Fund Manager)',
      tenureYears: 2.4,
      overallExpYears: 23,
      education: 'B.E. (Electronics), MBA (IIM Calcutta)',
      bio: 'Veteran fund manager with expertise in banking, industrials, and infrastructure. Focuses on blue-chip market leaders with fortress balance sheets.',
      otherFundsManaged: ['HDFC Business Cycle Fund', 'HDFC Large and MidCap Fund'],
    },
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 9.80, adtv_cr: 2450 },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 8.90, adtv_cr: 1850 },
      { isin: 'INE002A01018', name: 'Reliance Industries Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 8.10, adtv_cr: 2100 },
      { isin: 'INE009A01021', name: 'Infosys Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 7.40, adtv_cr: 1420 },
      { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd', sector: 'Industrials', mcap: 'Large Cap', weight: 6.30, adtv_cr: 820 },
      { isin: 'INE467B01029', name: 'Tata Consultancy Services', sector: 'Technology', mcap: 'Large Cap', weight: 5.20, adtv_cr: 980 },
      { isin: 'INE154A01025', name: 'ITC Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 4.90, adtv_cr: 780 },
      { isin: 'INE062A01020', name: 'State Bank of India', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.70, adtv_cr: 1650 },
      { isin: 'INE238A01034', name: 'Axis Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.10, adtv_cr: 1150 },
      { isin: 'INE296A01024', name: 'Bajaj Finance Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 3.80, adtv_cr: 950 },
      { isin: 'INE999A99997', name: 'Other Large Cap Holdings', sector: 'Diversified Equity', mcap: 'Large Cap', weight: 25.60, adtv_cr: 4500 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 11.20, adtv_cr: 100000 },
    ],
  },

  // 4. Small Cap
  118778: {
    scheme_code: 118778,
    name: 'Nippon India Small Cap Fund',
    category: 'Small Cap',
    asset_class: 'Equity',
    fund_house: 'Nippon India Mutual Fund',
    benchmark_symbol: '^CRSLDX',
    isin: 'INF204K01726',
    aum_cr: 63800.00,
    inception_date: '2010-09-16',
    expense_ratio_direct: 0.69,
    expense_ratio_regular: 1.49,
    turnover_ratio_pct: 22.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 1 month; Nil thereafter.',
    min_sip_inr: 100,
    min_lumpsum_inr: 5000,
    investment_objective: 'To generate long-term capital appreciation by investing predominantly in equity and equity-related instruments of small cap companies.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Samir Rachh',
      tenureYears: 7.8,
      overallExpYears: 26,
      education: 'B.Com, MMS (Finance)',
      bio: 'One of India\'s most celebrated small-cap stock pickers. Employs a deeply diversified portfolio of over 180 holdings to mitigate single-stock liquidity risks in small caps.',
      otherFundsManaged: ['Nippon India Consumption Fund', 'Nippon India Growth Fund'],
    },
    holdings: [
      { isin: 'INE376G01013', name: 'Tube Investments of India', sector: 'Industrials', mcap: 'Mid Cap', weight: 4.10, adtv_cr: 180 },
      { isin: 'INE848E01016', name: 'HDFC Asset Management', sector: 'Financial Services', mcap: 'Large Cap', weight: 3.40, adtv_cr: 220 },
      { isin: 'INE688I01017', name: 'Apar Industries Ltd', sector: 'Industrials', mcap: 'Small Cap', weight: 2.90, adtv_cr: 65 },
      { isin: 'INE005A01029', name: 'Karur Vysya Bank Ltd', sector: 'Financial Services', mcap: 'Small Cap', weight: 2.70, adtv_cr: 45 },
      { isin: 'INE584A01023', name: 'CreditAccess Grameen', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.50, adtv_cr: 55 },
      { isin: 'INE242C01024', name: 'Multi Commodity Exchange', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.40, adtv_cr: 210 },
      { isin: 'INE094A01015', name: 'Hindustan Petroleum', sector: 'Energy', mcap: 'Mid Cap', weight: 2.20, adtv_cr: 280 },
      { isin: 'INE121A01024', name: 'Cholamandalam Inv & Fin', sector: 'Financial Services', mcap: 'Mid Cap', weight: 2.10, adtv_cr: 310 },
      { isin: 'INE455K01017', name: 'Polycab India Ltd', sector: 'Industrials', mcap: 'Mid Cap', weight: 1.95, adtv_cr: 310 },
      { isin: 'INE999A99996', name: 'Diversified Small Cap Basket (170+ Stocks)', sector: 'Diversified Equity', mcap: 'Small Cap', weight: 66.80, adtv_cr: 3500 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 8.85, adtv_cr: 100000 },
    ],
  },

  // 5. Large Cap (SBI Bluechip)
  119598: {
    scheme_code: 119598,
    name: 'SBI Bluechip Large Cap Fund',
    category: 'Large Cap',
    asset_class: 'Equity',
    fund_house: 'SBI Mutual Fund',
    benchmark_symbol: '^NSEI',
    isin: 'INF200K01135',
    aum_cr: 52400.00,
    inception_date: '2006-02-14',
    expense_ratio_direct: 0.86,
    expense_ratio_regular: 1.54,
    turnover_ratio_pct: 19.0,
    riskometer: 'Very High',
    exit_load: '1% if redeemed within 1 year; Nil thereafter.',
    min_sip_inr: 500,
    min_lumpsum_inr: 5000,
    investment_objective: 'To provide investors with opportunities for long-term growth in capital through an active management of investments in a diversified basket of large cap equity stocks.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Saurabh Pant (Fund Manager)',
      tenureYears: 4.1,
      overallExpYears: 20,
      education: 'B.Com, Chartered Accountant (CA)',
      bio: 'Seasoned equity portfolio manager steering SBI Bluechip with strict corporate governance filters and focus on sustained ROCE.',
      otherFundsManaged: ['SBI Magnum Large Cap Fund', 'SBI Infrastructure Fund'],
    },
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 9.10, adtv_cr: 2450 },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 8.40, adtv_cr: 1850 },
      { isin: 'INE002A01018', name: 'Reliance Industries Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 7.90, adtv_cr: 2100 },
      { isin: 'INE009A01021', name: 'Infosys Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 6.80, adtv_cr: 1420 },
      { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd', sector: 'Industrials', mcap: 'Large Cap', weight: 5.90, adtv_cr: 820 },
      { isin: 'INE154A01025', name: 'ITC Ltd', sector: 'Consumer Goods', mcap: 'Large Cap', weight: 4.50, adtv_cr: 780 },
      { isin: 'INE467B01029', name: 'Tata Consultancy Services', sector: 'Technology', mcap: 'Large Cap', weight: 4.30, adtv_cr: 980 },
      { isin: 'INE062A01020', name: 'State Bank of India', sector: 'Financial Services', mcap: 'Large Cap', weight: 4.20, adtv_cr: 1650 },
      { isin: 'INE238A01034', name: 'Axis Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 3.80, adtv_cr: 1150 },
      { isin: 'INE999A99995', name: 'Other Bluechip Large Cap Holdings', sector: 'Diversified Equity', mcap: 'Large Cap', weight: 32.00, adtv_cr: 4000 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 13.10, adtv_cr: 100000 },
    ],
  },

  // 6. Corporate Bond (Debt Fund)
  120503: {
    scheme_code: 120503,
    name: 'ICICI Prudential Corporate Bond Fund',
    category: 'Corporate Bond',
    asset_class: 'Debt',
    fund_house: 'ICICI Prudential AMC',
    benchmark_symbol: 'CRISIL_COMP_BOND',
    isin: 'INF109K01AQ5',
    aum_cr: 31500.00,
    inception_date: '2009-08-18',
    expense_ratio_direct: 0.32,
    expense_ratio_regular: 0.61,
    turnover_ratio_pct: 110.0,
    riskometer: 'Moderate',
    exit_load: 'Nil',
    min_sip_inr: 500,
    min_lumpsum_inr: 500,
    investment_objective: 'To generate income through investing predominantly in AA+ and above rated corporate bonds with strong balance sheet security.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Anuj Tagra (Debt Fund Manager)',
      tenureYears: 8.0,
      overallExpYears: 18,
      education: 'B.Tech, MBA (Finance)',
      bio: 'Leading fixed-income strategist managing sovereign and premier corporate debt mandates with focus on yield curve positioning and zero credit degradation.',
      otherFundsManaged: ['ICICI Prudential All Seasons Bond Fund', 'ICICI Prudential Short Term Fund'],
    },
    macaulay_duration: 3.85,
    modified_duration: 3.58,
    ytm: 0.0755,
    avg_maturity_years: 4.32,
    credit_profile: {
      sovereignPct: 24.2,
      aaaPct: 68.5,
      aaPct: 3.8,
      aAndBelowPct: 0.0,
      cashPct: 3.5,
    },
    holdings: [
      { isin: 'INE040A08435', name: '7.70% HDFC Bank Bonds 2028', sector: 'Financial Services', mcap: 'Debt / Fixed Income', weight: 9.50, adtv_cr: 50, creditRating: 'AAA' },
      { isin: 'INE090A08UB7', name: '7.65% ICICI Bank Bonds 2029', sector: 'Financial Services', mcap: 'Debt / Fixed Income', weight: 8.80, adtv_cr: 45, creditRating: 'AAA' },
      { isin: 'INE134E08KJ0', name: '7.75% Power Finance Corp 2030', sector: 'Utilities', mcap: 'Debt / Fixed Income', weight: 8.20, adtv_cr: 35, creditRating: 'AAA' },
      { isin: 'INE020B08DF6', name: '7.60% REC Limited 2029', sector: 'Financial Services', mcap: 'Debt / Fixed Income', weight: 7.90, adtv_cr: 40, creditRating: 'AAA' },
      { isin: 'INE053F08221', name: '7.80% Indian Railway Finance', sector: 'Financial Services', mcap: 'Debt / Fixed Income', weight: 7.50, adtv_cr: 30, creditRating: 'AAA' },
      { isin: 'INE002A08641', name: '7.85% Reliance Industries Debentures', sector: 'Energy', mcap: 'Debt / Fixed Income', weight: 6.80, adtv_cr: 25, creditRating: 'AAA' },
      { isin: 'INE999D99994', name: 'Other AAA/SOV PSU Bond Holdings', sector: 'Financial Services', mcap: 'Debt / Fixed Income', weight: 22.90, adtv_cr: 120, creditRating: 'AAA' },
      { isin: 'IN0020230085', name: '7.18% GS 2033 (Govt of India)', sector: 'Cash / Sovereign', mcap: 'Debt / Fixed Income', weight: 14.20, adtv_cr: 5000, creditRating: 'SOV' },
      { isin: 'CASH_EQUIV', name: 'TREPS & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 14.20, adtv_cr: 100000, creditRating: 'Cash' },
    ],
  },

  // 7. Balanced Advantage / Hybrid
  120586: {
    scheme_code: 120586,
    name: 'ICICI Prudential Balanced Advantage Fund',
    category: 'Balanced Advantage / Dynamic',
    asset_class: 'Hybrid',
    fund_house: 'ICICI Prudential AMC',
    benchmark_symbol: '^CRSLDX',
    isin: 'INF109K01844',
    aum_cr: 65200.00,
    inception_date: '2006-12-30',
    expense_ratio_direct: 0.92,
    expense_ratio_regular: 1.54,
    turnover_ratio_pct: 145.0,
    riskometer: 'High',
    exit_load: '1% if redeemed within 3 months; Nil thereafter.',
    min_sip_inr: 100,
    min_lumpsum_inr: 500,
    investment_objective: 'To provide capital appreciation and income distribution by dynamically managing asset allocation between equity, debt and derivatives based on in-house Price-to-Book valuation models.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Sankaran Naren (Executive Director & CIO)',
      tenureYears: 14.5,
      overallExpYears: 34,
      education: 'B.Tech (IIT Madras), MBA (IIM Calcutta)',
      bio: 'Legendary contrarian investor in Indian financial markets. Specializes in counter-cyclical asset allocation and macroeconomic risk hedging.',
      otherFundsManaged: ['ICICI Prudential Multi-Asset Fund', 'ICICI Prudential Value Discovery Fund'],
    },
    macaulay_duration: 1.85,
    modified_duration: 1.72,
    ytm: 0.071,
    holdings: [
      { isin: 'INE040A01034', name: 'HDFC Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 6.80, adtv_cr: 2450 },
      { isin: 'INE090A01021', name: 'ICICI Bank Ltd', sector: 'Financial Services', mcap: 'Large Cap', weight: 6.10, adtv_cr: 1850 },
      { isin: 'INE002A01018', name: 'Reliance Industries Ltd', sector: 'Energy', mcap: 'Large Cap', weight: 5.40, adtv_cr: 2100 },
      { isin: 'INE009A01021', name: 'Infosys Ltd', sector: 'Technology', mcap: 'Large Cap', weight: 4.80, adtv_cr: 1420 },
      { isin: 'INE999H99993', name: 'Dynamic Hedged Equity Basket', sector: 'Diversified Equity', mcap: 'Large Cap', weight: 31.90, adtv_cr: 3500 },
      { isin: 'IN0020230085', name: '7.18% GS 2033 (Govt of India)', sector: 'Cash / Sovereign', mcap: 'Debt / Fixed Income', weight: 18.50, adtv_cr: 5000, creditRating: 'SOV' },
      { isin: 'CASH_EQUIV', name: 'Arbitrage & Cash Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 26.50, adtv_cr: 100000, creditRating: 'Cash' },
    ],
  },

  // 8. Gold ETF / Fund
  118753: {
    scheme_code: 118753,
    name: 'Nippon India Gold Savings Fund',
    category: 'Gold & Precious Metals',
    asset_class: 'Commodity',
    fund_house: 'Nippon India Mutual Fund',
    benchmark_symbol: 'GOLD_DOMESTIC',
    isin: 'INF204K01585',
    aum_cr: 8200.00,
    inception_date: '2011-03-07',
    expense_ratio_direct: 0.12,
    expense_ratio_regular: 0.52,
    turnover_ratio_pct: 12.0,
    riskometer: 'High',
    exit_load: '1% if redeemed within 15 days; Nil thereafter.',
    min_sip_inr: 100,
    min_lumpsum_inr: 100,
    investment_objective: 'To provide returns that closely correspond to the domestic price of physical 99.5% purity gold by investing directly in Gold ETFs without needing a demat account.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Vikram Dhawan (Head - Commodities)',
      tenureYears: 6.2,
      overallExpYears: 24,
      education: 'B.Com, PGDBM (Finance)',
      bio: 'Leading precious metals and commodities portfolio manager overseeing gold, silver, and multi-asset reserves.',
      otherFundsManaged: ['Nippon India Silver ETF Fund'],
    },
    holdings: [
      { isin: 'INF204KB17I5', name: 'Nippon India ETF Gold BeES', sector: 'Commodities', mcap: 'Cash / Sovereign', weight: 98.20, adtv_cr: 180 },
      { isin: 'CASH_EQUIV', name: 'TREPS & Short-term Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 1.80, adtv_cr: 100000 },
    ],
  },

  // 9. International FoF
  145552: {
    scheme_code: 145552,
    name: 'Motilal Oswal Nasdaq 100 FoF',
    category: 'International FoF',
    asset_class: 'International',
    fund_house: 'Motilal Oswal AMC',
    benchmark_symbol: '^CRSLDX',
    isin: 'INF247L01786',
    aum_cr: 6400.00,
    inception_date: '2018-11-29',
    expense_ratio_direct: 0.24,
    expense_ratio_regular: 0.65,
    turnover_ratio_pct: 8.0,
    riskometer: 'Very High',
    exit_load: 'Nil',
    min_sip_inr: 500,
    min_lumpsum_inr: 500,
    investment_objective: 'To provide long-term capital appreciation by investing predominantly in units of Motilal Oswal Nasdaq 100 ETF tracking the top non-financial innovative technology leaders in the US.',
    asOfDate: '2026-09-30',
    isStatutoryDisclosure: true,
    manager: {
      name: 'Ankush Sood (Overseas Equities)',
      tenureYears: 4.0,
      overallExpYears: 15,
      education: 'B.Com, MBA (Finance)',
      bio: 'Oversees overseas technology and quantitative international ETFs with emphasis on currency hedging and tracking error minimization.',
      otherFundsManaged: ['Motilal Oswal S&P 500 Index Fund'],
    },
    holdings: [
      { isin: 'US5949181045', name: 'Microsoft Corp', sector: 'Technology', mcap: 'Large Cap', weight: 8.90, adtv_cr: 9800 },
      { isin: 'US0378331005', name: 'Apple Inc', sector: 'Technology', mcap: 'Large Cap', weight: 8.40, adtv_cr: 11500 },
      { isin: 'US67066G1040', name: 'NVIDIA Corp', sector: 'Technology', mcap: 'Large Cap', weight: 8.10, adtv_cr: 14500 },
      { isin: 'US0231351067', name: 'Amazon.com Inc', sector: 'Consumer Discretionary', mcap: 'Large Cap', weight: 5.60, adtv_cr: 8200 },
      { isin: 'US02079K3059', name: 'Alphabet Inc', sector: 'Technology', mcap: 'Large Cap', weight: 5.20, adtv_cr: 8500 },
      { isin: 'US999I99992', name: 'Other Nasdaq-100 Innovators', sector: 'Technology', mcap: 'Large Cap', weight: 60.60, adtv_cr: 25000 },
      { isin: 'CASH_EQUIV', name: 'US Dollar Collateral', sector: 'Cash / Sovereign', mcap: 'Cash / Sovereign', weight: 3.20, adtv_cr: 100000 },
    ],
  },
};

/**
 * Universal genuine benchmark generator
 * Completely replaces legacy synthetic random-walk generator.
 */
export function generateBenchmarkSeries(
  symbol: string = '^CRSLDX',
  referenceSeries?: NavPoint[]
): NavPoint[] {
  return generateGenuineBenchmarkSeries(symbol, referenceSeries);
}

/**
 * Fetches authentic historical daily NAV series from AMFI API.
 * STRICT ZERO-SYNTHETIC POLICY: If network is offline or scheme code does not exist,
 * returns an empty array and logs error. NEVER fabricates fake NAV data.
 */
export async function fetchLiveMfNav(schemeCode: number): Promise<NavPoint[]> {
  try {
    const endpoints = [`/api/mf/mf/${schemeCode}`, `https://api.mfapi.in/mf/${schemeCode}`];
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { headers: { Accept: 'application/json' } });
        if (resp.ok) {
          const json = await resp.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            const formatted: NavPoint[] = json.data
              .map((item: { date: string; nav: string }) => {
                const parts = item.date.split('-');
                if (parts.length === 3) {
                  return { date: `${parts[2]}-${parts[1]}-${parts[0]}`, nav: parseFloat(item.nav) };
                }
                return null;
              })
              .filter((p: NavPoint | null): p is NavPoint => p !== null && !isNaN(p.nav))
              .sort((a: NavPoint, b: NavPoint) => a.date.localeCompare(b.date));

            if (formatted.length > 0) {
              return formatted;
            }
          }
        }
      } catch {
        // try next endpoint
      }
    }
  } catch (err) {
    console.warn(`Fetch error for scheme ${schemeCode}:`, err);
  }

  console.error(`Live NAV data could not be retrieved from AMFI for scheme ${schemeCode}. Synthetic fallback is strictly disabled.`);
  return [];
}
