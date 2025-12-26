export type WidgetType = "card" | "table" | "chart";

export type CardItem = {
  label: string;
  valuePath: string;
  prefix?: string;
  suffix?: string;
};

export type CardWidgetConfig = {
  id: string;
  title: string;
  apiUrl: string;
  refreshInterval: number;
  type: "card";
  dataPath?: string;
  items: CardItem[];
};

export type TableColumn = {
  header: string;
  dataPath: string;
};

export type TableWidgetConfig = {
  id: string;
  title: string;
  apiUrl: string;
  refreshInterval: number;
  type: "table";
  dataPath: string;
  columns: TableColumn[];
};

export type ChartWidgetConfig = {
  id: string;
  title: string;
  apiUrl: string;
  refreshInterval: number;
  type: "chart";
  dataPath: string;
  categoryKey: string;
  valueKey: string;
};

export type WidgetConfig = CardWidgetConfig | TableWidgetConfig | ChartWidgetConfig;
