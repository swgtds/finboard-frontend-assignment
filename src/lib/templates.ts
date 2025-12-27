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
      refreshInterval: 600, // 10 minutes (increased from 5 minutes to respect rate limits)
      type: 'chart',
      dataPath: 'prices',
      categoryKey: '[0]',
      valueKey: '[1]'
    } as Omit<ChartWidgetConfig, 'id'>
  },
  {
    id: 'stocks-52week-high',
    name: 'Stocks 52-Week High',
    description: 'Stocks trading near their 52-week highs',
    category: 'stocks',
    config: {
      title: '52-Week High Stocks',
      apiUrl: 'API_URL_TO_BE_ADDED',
      refreshInterval: 300,
      type: 'table',
      dataPath: '',
      columns: [
        { header: 'Symbol', dataPath: 'symbol' },
        { header: 'Company', dataPath: 'name' },
        { header: 'Current Price', dataPath: 'price' },
        { header: '52W High', dataPath: 'week52High' },
        { header: '% from High', dataPath: 'percentFromHigh' }
      ]
    } as Omit<TableWidgetConfig, 'id'>
  }
];