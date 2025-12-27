import { WidgetConfig, CardWidgetConfig, TableWidgetConfig, ChartWidgetConfig } from "@/lib/types";

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  category: 'stocks' | 'crypto' | 'forex' | 'commodities' | 'indices' | 'portfolio';
  config: Omit<WidgetConfig, 'id'>;
}

export const widgetTemplates: WidgetTemplate[] = [
  {
    id: 'ethereum-price',
    name: 'Ethereum Price Tracker',
    description: 'Real-time Ethereum price with comprehensive statistics',
    category: 'crypto',
    config: {
      title: 'Ethereum',
      apiUrl: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
      refreshInterval: 60,
      type: 'card',
      dataPath: 'data',
      items: [
        { label: 'Current Price', valuePath: 'data.amount'},
        { label: 'Currency', valuePath: 'data.currency' },
        { label: 'Base Currency', valuePath: 'data.base' }
      ]
    } as Omit<CardWidgetConfig, 'id'>
  },
  {
    id: 'bitcoin-chart-inr',
    name: 'Bitcoin Price Chart (INR)',
    description: 'Bitcoin price chart in INR with time series data (24h) - Updates every 10 minutes',
    category: 'crypto',
    config: {
      title: 'Bitcoin Price Chart (INR)',
      apiUrl: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=inr&days=1',
      refreshInterval: 600, // 10 minutes 
      type: 'chart',
      dataPath: 'prices',
      categoryKey: '[0]',
      valueKey: '[1]'
    } as Omit<ChartWidgetConfig, 'id'>
  },
  {
    id: 'top-10-crypto',
    name: 'Top 10 Cryptocurrencies',
    description: 'Top 10 cryptocurrencies by market cap with prices and 24h changes',
    category: 'crypto',
    config: {
      title: 'Top 10 Crypto by Market Cap',
      apiUrl: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false',
      refreshInterval: 300, // 5 minutes
      type: 'table',
      dataPath: '',
      columns: [
        { header: 'Rank', dataPath: 'market_cap_rank' },
        { header: 'Name', dataPath: 'name' },
        { header: 'Symbol', dataPath: 'symbol' },
        { header: 'Price (USD)', dataPath: 'current_price' }
      ]
    } as Omit<TableWidgetConfig, 'id'>
  },
  {
    id: 'stocks-52week-high',
    name: 'Stocks 52-Week High',
    description: 'Top 6 Indian stocks trading near their 52-week highs',
    category: 'stocks',
    config: {
      title: '52-Week High Stocks',
      apiUrl: 'https://stock.indianapi.in/fetch_52_week_high_low_data',
      refreshInterval: 1800, 
      type: 'table',
      dataPath: 'BSE_52WeekHighLow.high52Week',
      columns: [
        { header: 'Ticker', dataPath: 'ticker' },
        { header: 'Company', dataPath: 'company' },
        { header: 'Current Price', dataPath: 'price' },
        { header: '52W High', dataPath: '52_week_high' }
      ]
    } as Omit<TableWidgetConfig, 'id'>
  },
  {
    id: 'stocks-52week-low',
    name: 'Stocks 52-Week Low',
    description: 'Top 6 Indian stocks trading near their 52-week lows',
    category: 'stocks',
    config: {
      title: '52-Week Low Stocks',
      apiUrl: 'https://stock.indianapi.in/fetch_52_week_high_low_data',
      refreshInterval: 1800, 
      type: 'table',
      dataPath: 'BSE_52WeekHighLow.low52Week',
      columns: [
        { header: 'Ticker', dataPath: 'ticker' },
        { header: 'Company', dataPath: 'company' },
        { header: 'Current Price', dataPath: 'price' },
        { header: '52W Low', dataPath: '52_week_low' }
      ]
    } as Omit<TableWidgetConfig, 'id'>
  }
];