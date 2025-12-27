import { WidgetConfig, CardWidgetConfig, TableWidgetConfig, ChartWidgetConfig } from "@/lib/types";

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: 'stocks' | 'crypto' | 'forex' | 'commodities' | 'indices' | 'portfolio';
  config: Omit<WidgetConfig, 'id'>;
}

export const widgetTemplates: WidgetTemplate[] = [
  {
    id: 'bitcoin-price',
    name: 'Bitcoin Price Tracker',
    description: 'Real-time Bitcoin price with comprehensive statistics',
    thumbnail: '₿',
    category: 'crypto',
    config: {
      title: 'Bitcoin',
      apiUrl: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
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
    id: 'bitcoin-chart',
    name: 'Bitcoin Price Chart',
    description: 'Bitcoin price chart with time series data (24h)',
    thumbnail: '📊',
    category: 'crypto',
    config: {
      title: 'Bitcoin Price Chart (24h)',
      apiUrl: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1',
      refreshInterval: 300,
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
    thumbnail: '📈',
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