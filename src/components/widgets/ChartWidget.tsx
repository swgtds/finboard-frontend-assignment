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
    return rawData.map((item) => ({
      category: item[config.categoryKey]?.toString() || "N/A",
      value: Number(item[config.valueKey]) || 0,
    })).slice(0, 15); // Limit data points for readability
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
