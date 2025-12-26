"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartWidgetConfig, WidgetConfig } from "@/lib/types";
import { useTheme } from "next-themes";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type ChartWidgetProps = {
  data: any[];
  config: WidgetConfig & ChartWidgetConfig;
};

type FormattedDataPoint = {
  category: string;
  value: number;
};

export function ChartWidget({ data: rawData, config }: ChartWidgetProps) {
  const { theme } = useTheme();

  const formattedData: FormattedDataPoint[] = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    
    if (rawData.length > 0 && Array.isArray(rawData[0])) {
      return rawData.map((item, index) => {
        if (Array.isArray(item) && item.length >= 2) {
          let category: string;
          let value: number;
          
          if (config.categoryKey && config.valueKey) {
            const categoryIndex = parseInt(config.categoryKey.replace(/[\[\]]/g, ''));
            const valueIndex = parseInt(config.valueKey.replace(/[\[\]]/g, ''));
            
            const categoryValue = item[categoryIndex];
            const valueValue = item[valueIndex];
            
            if (typeof categoryValue === 'number' && categoryValue > 1000000000) {
              category = new Date(categoryValue).toLocaleDateString();
            } else {
              category = String(categoryValue);
            }
            
            value = Number(valueValue) || 0;
          } else {
            const timestamp = item[0];
            value = Number(item[1]) || 0;
            
            if (typeof timestamp === 'number' && timestamp > 1000000000) {
              category = new Date(timestamp).toLocaleDateString();
            } else {
              category = String(timestamp);
            }
          }
          
          return { category, value };
        }
        return { category: `Point ${index + 1}`, value: 0 };
      }).slice(0, 15);
    }
    
    return rawData.map((item) => ({
      category: item[config.categoryKey]?.toString() || "N/A",
      value: Number(item[config.valueKey]) || 0,
    })).slice(0, 15);
  }, [rawData, config.categoryKey, config.valueKey]);

  const chartColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      ticks: isDark ? 'hsl(210 17% 95%)' : 'hsl(221 39% 16%)',
      tooltipBg: isDark ? 'hsl(221 28% 18%)' : 'hsl(210 17% 100%)',
      tooltipBorder: isDark ? 'hsl(221 20% 24%)' : 'hsl(210 10% 85%)',
      line: isDark ? 'hsl(191 55% 51%)' : 'hsl(221 39% 26%)'
    };
  }, [theme]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.ticks,
          bodyColor: chartColors.ticks,
          borderColor: chartColors.tooltipBorder,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: {
            color: chartColors.ticks,
            font: { size: 10 },
          },
          grid: {
            color: chartColors.grid,
          },
        },
        y: {
          ticks: {
            color: chartColors.ticks,
            font: { size: 10 },
          },
          grid: {
            color: chartColors.grid,
          },
        },
      },
    };
  }, [chartColors]);

  const chartData = useMemo(() => {
    return {
      labels: formattedData.map((d) => d.category),
      datasets: [
        {
          label: config.valueKey,
          data: formattedData.map((d) => d.value),
          borderColor: chartColors.line,
          backgroundColor: chartColors.line.replace(')', ', 0.2)').replace('hsl', 'hsla'),
          tension: 0.2,
          pointBackgroundColor: chartColors.line,
          pointBorderColor: chartColors.line,
        },
      ],
    };
  }, [formattedData, config.valueKey, chartColors]);


  return (
    <div className="h-full w-full flex flex-col">
      <div className="w-full h-full">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
